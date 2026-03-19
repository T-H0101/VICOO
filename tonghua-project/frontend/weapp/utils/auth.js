var http = require('./request');

function checkLogin() {
  var token = wx.getStorageSync('accessToken');
  return !!token;
}

function ensureLogin() {
  return new Promise(function(resolve, reject) {
    if (checkLogin()) {
      resolve(wx.getStorageSync('accessToken'));
    } else {
      doLogin().then(resolve).catch(reject);
    }
  });
}

function doLogin() {
  return new Promise(function(resolve, reject) {
    wx.login({
      success: function(res) {
        if (res.code) {
          http.post('/auth/wx-login', { code: res.code }).then(function(r) {
            wx.setStorageSync('accessToken', r.accessToken);
            wx.setStorageSync('refreshToken', r.refreshToken);
            resolve(r.accessToken);
          }).catch(reject);
        } else {
          reject(new Error('login failed'));
        }
      },
      fail: reject
    });
  });
}

function logout() {
  wx.removeStorageSync('accessToken');
  wx.removeStorageSync('refreshToken');
  getApp().globalData.userInfo = null;
  getApp().globalData.token = null;
}

function getToken() {
  return wx.getStorageSync('accessToken');
}

module.exports = { checkLogin: checkLogin, ensureLogin: ensureLogin, doLogin: doLogin, logout: logout, getToken: getToken };
