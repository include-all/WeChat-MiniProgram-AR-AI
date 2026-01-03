// 图片-模型映射配置
// 可以在这里添加多个marker，每个marker对应一张图片和一个3D模型

const markerConfigs = [
  {
    id: 'marker_1',
    name: '机器人',
    // 识别图片URL - 使用本地测试图片
    imageUrl: 'https://m.sanyue.red/wechat/imgs/image_pattern_1.jpg',
    // 3D模型URL
    modelUrl: 'https://m.sanyue.red/demo/gltf/robot.glb',
    // 模型缩放比例
    modelScale: 0.05,
    // 平面遮罩层缩放比例
    planeScale: 0.28,
    // 平面尺寸（宽度和高度，需要与识别图片的比例相同）
    planeSize: { width: 3.75, height: 2.06 },
    // 动画名称（如果模型有动画）
    animationName: 'Dance',
    // 模型位置偏移
    position: { x: 0, y: 0, z: 0 },
    // 模型旋转
    rotation: { x: 0, y: 0, z: 0 }
  },
  {
    id: 'marker_2',
    name: '太阳镜',
    imageUrl: 'https://digital-person-daily.oss-cn-hangzhou.aliyuncs.com/FileUpload/8/UID_1915/Image/Avatar/32f9678d272b4790b1c47201a2be602e/封面1767165597466',
    modelUrl: 'https://m.sanyue.red/demo/gltf/sunglass.glb',
    modelScale: 0.002,
    planeScale: 0.28,
    planeSize: { width: 3.75, height: 2.06 },
    animationName: null,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  },
  {
    id: 'marker_3',
    name: '光标',
    imageUrl: 'https://img10.360buyimg.com/n12/jfs/t1/164636/40/47177/217237/66f3cfc4F8f4a5d06/6e2a68b07277cbd3.png',
    modelUrl: 'https://m.sanyue.red/demo/gltf/reticle.glb',
    modelScale: 1,
    planeScale: 0.28,
    planeSize: { width: 3.75, height: 2.06 },
    animationName: null,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  }
]

module.exports = {
  markerConfigs
}
