const cameraBusiness = require('../../utils/cameraBusiness.js')
const { markerConfigs } = require('../../utils/markerConfig.js')

Page({
  data: {
    menuButtonTop: 32,
    menuButtonHeight: 33,
    patternImageUrl: markerConfigs[0]?.imageUrl || ''
  },
  onReady() {
    console.log('onReady')
    // 画布id
    const canvasId = 'canvas1'
    
    // 获取小程序右上角胶囊按钮的坐标，用作自定义导航栏。
    const menuButton = wx.getMenuButtonBoundingClientRect()

    this.setData({
      // 胶囊按钮与手机屏幕顶端的间距
      menuButtonTop: menuButton.top,
      // 胶囊按钮的高度
      menuButtonHeight: menuButton.height,
    })

    // 先请求相机权限
    wx.authorize({
      scope: 'scope.camera',
      success: () => {
        console.log('相机权限授权成功')
        this.initAR(canvasId)
      },
      fail: () => {
        console.log('相机权限授权失败')
        wx.showModal({
          title: '提示',
          content: '需要相机权限才能使用AR功能',
          showCancel: false,
          success: (res) => {
            if (res.confirm) {
              wx.openSetting({
                success: (settingRes) => {
                  if (settingRes.authSetting['scope.camera']) {
                    this.initAR(canvasId)
                  }
                }
              })
            }
          }
        })
      }
    })
  },

  initAR(canvasId) {
    // 获取画布组件
    wx.createSelectorQuery()
      .select('#' + canvasId)
      .node()
      .exec(res => {
        // 画布组件
        const canvas1 = res[0].node
        // 启动AR会话
        cameraBusiness.initEnvironment(canvas1, function () {
          // 创建AR的坐标系并加载所有marker和模型
          cameraBusiness.initWorldTrack()
        })
      })
  },
  onUnload() {
    console.log('onUnload')
    // 将对象回收
    cameraBusiness.dispose()

  },
  // 后退按钮的点击事件
  backBtn_callback() {
    wx.navigateBack()
  },
});
