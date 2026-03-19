App({
  globalData: {
    userInfo: null,
    token: null,
    refreshToken: null,
    systemInfo: null,
    baseUrl: 'https://api.tonghua.example.com',
    isConnected: true
  },
  onLaunch: function() {
    this.checkNetworkStatus();
    this.getSystemInfo();
    this.autoLogin();
  },
  getSystemInfo: function() {
    this.globalData.systemInfo = wx.getSystemInfoSync();
  },
  checkNetworkStatus: function() {
    var self = this;
    wx.getNetworkType({ success: function(r) { self.globalData.isConnected = r.networkType !== 'none'; } });
  },
  autoLogin: function() {
    var token = wx.getStorageSync('accessToken');
    if (token) { this.globalData.token = token; }
  },
  wxLogin: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      wx.login({
        success: function(res) {
          if (res.code) {
            var request = require('./utils/request');
            request.post('/auth/wx-login', { code: res.code })
              .then(function(r) {
                self.globalData.token = r.accessToken;
                self.globalData.refreshToken = r.refreshToken;
                wx.setStorageSync('accessToken', r.accessToken);
                wx.setStorageSync('refreshToken', r.refreshToken);
                resolve(r);
              }).catch(reject);
          } else { reject(new Error('login failed')); }
        },
        fail: reject
      });
    });
  },
  onError: function(error) { console.error('App Error:', error); },
  onPageNotFound: function() { wx.redirectTo({ url: '/pages/index/index' }); }
});
