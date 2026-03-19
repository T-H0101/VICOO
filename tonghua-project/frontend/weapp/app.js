var config = require('./config');

App({
  globalData: {
    userInfo: null,
    systemInfo: null,
    baseUrl: config.baseUrl,
    isConnected: true
  },
  onLaunch: function() {
    this.checkNetworkStatus();
    this.getSystemInfo();
  },
  getSystemInfo: function() {
    this.globalData.systemInfo = wx.getSystemInfoSync();
  },
  checkNetworkStatus: function() {
    var self = this;
    wx.getNetworkType({ success: function(r) { self.globalData.isConnected = r.networkType !== 'none'; } });
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
                // Server returns token in JSON body
                // Save token client-side for Authorization header
                if (r.success && r.data && r.data.access_token) {
                  self.globalData.token = r.data.access_token;
                }
                resolve(r);
              }).catch(reject);
          } else { reject(new Error('login failed')); }
        },
        fail: reject
      });
    });
  },
  onError: function(error) {
    // Error logging handled by server-side monitoring
  },
  onPageNotFound: function() { wx.redirectTo({ url: '/pages/index/index' }); }
});
