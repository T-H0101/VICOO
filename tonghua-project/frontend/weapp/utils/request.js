var app = getApp();
var BASE_URL = app.globalData.baseUrl;
var MAX_RETRIES = 3;
var isRefreshing = false;
var refreshQueue = [];

function generateNonce() {
  // Use crypto-safe random bytes for nonce
  var array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback: use multiple Math.random calls with timestamp
    for (var i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    array[0] ^= Date.now() & 0xFF;
    array[1] ^= (Date.now() >> 8) & 0xFF;
  }
  return Array.from(array).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function request(options) {
  return new Promise(function(resolve, reject) {
    var token = wx.getStorageSync('accessToken');
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : '',
        'X-Timestamp': Date.now().toString(),
        'X-Nonce': generateNonce()
      },
      success: function(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Prevent infinite recursion: only refresh once per request
          if (options._refreshAttempted) {
            wx.removeStorageSync('accessToken');
            wx.removeStorageSync('refreshToken');
            wx.navigateTo({ url: '/pages/user/login/index' });
            reject(new Error('Session expired. Please log in again.'));
            return;
          }
          options._refreshAttempted = true;
          refreshToken().then(function() {
            resolve(request(options));
          }).catch(function(err) {
            wx.removeStorageSync('accessToken');
            wx.removeStorageSync('refreshToken');
            wx.navigateTo({ url: '/pages/user/login/index' });
            reject(err);
          });
        } else {
          var msg = (res.data && res.data.message) ? res.data.message : 'Request Error';
          wx.showToast({ title: msg, icon: 'none' });
          reject(new Error(msg));
        }
      },
      fail: function(err) {
        if (options._retry && options._retry < MAX_RETRIES) {
          options._retry = (options._retry || 0) + 1;
          setTimeout(function() { resolve(request(options)); }, 1000);
        } else {
          wx.showToast({ title: 'Network Error', icon: 'none' });
          reject(err);
        }
      }
    });
  });
}

function refreshToken() {
  // Prevent concurrent refresh attempts
  if (isRefreshing) {
    return new Promise(function(resolve, reject) {
      refreshQueue.push({ resolve: resolve, reject: reject });
    });
  }

  isRefreshing = true;
  var refresh = wx.getStorageSync('refreshToken');

  return new Promise(function(resolve, reject) {
    wx.request({
      url: BASE_URL + '/auth/refresh',
      method: 'POST',
      data: { refreshToken: refresh },
      header: { 'Content-Type': 'application/json' },
      success: function(res) {
        isRefreshing = false;
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.accessToken) {
          wx.setStorageSync('accessToken', res.data.accessToken);
          if (res.data.refreshToken) {
            wx.setStorageSync('refreshToken', res.data.refreshToken);
          }
          // Resolve queued requests
          refreshQueue.forEach(function(item) { item.resolve(); });
          refreshQueue = [];
          resolve(res.data);
        } else {
          var err = new Error('Token refresh failed');
          refreshQueue.forEach(function(item) { item.reject(err); });
          refreshQueue = [];
          reject(err);
        }
      },
      fail: function(err) {
        isRefreshing = false;
        refreshQueue.forEach(function(item) { item.reject(err); });
        refreshQueue = [];
        reject(err);
      }
    });
  });
}

function get(url, data) {
  return request({ url: url, method: 'GET', data: data });
}

function post(url, data) {
  return request({ url: url, method: 'POST', data: data });
}

function put(url, data) {
  return request({ url: url, method: 'PUT', data: data });
}

function del(url, data) {
  return request({ url: url, method: 'DELETE', data: data });
}

function upload(url, filePath, name, formData) {
  return new Promise(function(resolve, reject) {
    var token = wx.getStorageSync('accessToken');
    wx.uploadFile({
      url: BASE_URL + url,
      filePath: filePath,
      name: name || 'file',
      formData: formData || {},
      header: {
        'Authorization': token ? 'Bearer ' + token : '',
        'X-Timestamp': Date.now().toString(),
        'X-Nonce': generateNonce()
      },
      success: function(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data));
          } catch (e) {
            resolve(res.data);
          }
        } else if (res.statusCode === 401) {
          refreshToken().then(function() {
            resolve(upload(url, filePath, name, formData));
          }).catch(function(err) {
            wx.removeStorageSync('accessToken');
            wx.removeStorageSync('refreshToken');
            wx.navigateTo({ url: '/pages/user/login/index' });
            reject(err);
          });
        } else {
          reject(new Error('Upload failed: ' + res.statusCode));
        }
      },
      fail: function(err) {
        wx.showToast({ title: '上传失败', icon: 'none' });
        reject(err);
      }
    });
  });
}

module.exports = { request: request, get: get, post: post, put: put, del: del, upload: upload };
