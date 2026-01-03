// threejs库
const { createScopedThreejs } = require('threejs-miniprogram');
// 加载gltf库
const { registerGLTFLoader } = require('../../utils/gltf-loader.js');
// 相机每帧图像作为threejs场景的背景图
const webglBusiness = require('./webglBusiness.js')
// marker配置
const { markerConfigs } = require('./markerConfig.js')
// 近截面
const NEAR = 0.001
// 远截面
const FAR = 1000
// 相机、场景、渲染器
var camera, scene, renderer;
// 画布对象
var canvas;
// var touchX, touchY;
// threejs对象
var THREE;
// 自定义的3D模型
var mainModel, mainPlane;
// AR会话
var session;
// 光标模型、跟踪时间的对象
var reticle, clock;
// 保存3D模型的动画
var mixers = [];
// 设备像素比例
var devicePixelRatio;
var screenWidth, screenHeight;
// marker ID列表（支持多个marker）
var markerIds = [];
// 存储所有marker对应的模型和配置
var markerModels = {};

function initWorldTrack() {
    if (!session) {
        console.log('The VKSession is not created.')
        return
    }

    // 检查API是否存在
    if (!session.addMarker) {
        return
    }

    session.on('addAnchors', anchors => {
        console.log('addAnchors', anchors.length, '个marker被识别')
        wx.hideLoading();
        
        // 显示识别到的marker对应的模型
        anchors.forEach(anchor => {
            const markerId = anchor.id
            console.log('addAnchors 识别到marker:', markerId)
            
            if (markerModels[markerId] && markerModels[markerId].model) {
                const model = markerModels[markerId].model
                model.visible = true
                console.log('addAnchors 显示模型:', markerId)
            }
        })
    })

    session.on('updateAnchors', anchors => {
        console.log('updateAnchors', anchors.length, '个marker更新')
        
        // 更新识别到的marker对应的模型位置
        anchors.forEach(anchor => {
            const markerId = anchor.id
            
            if (markerModels[markerId] && markerModels[markerId].model) {
                const model = markerModels[markerId].model
                model.visible = true
                
                // 更新模型的位置和旋转，但保持原始缩放比例
                model.matrix.fromArray(anchor.transform)
                const position = new THREE.Vector3()
                const quaternion = new THREE.Quaternion()
                model.matrix.decompose(position, quaternion, model.scale)
                model.position.copy(position)
                model.quaternion.copy(quaternion)
                // 恢复原始缩放比例
                if (markerModels[markerId].originalScale) {
                    model.scale.set(
                        markerModels[markerId].originalScale,
                        markerModels[markerId].originalScale,
                        markerModels[markerId].originalScale
                    )
                }
            }
        })
    })

    session.on('removeAnchors', anchors => {
        console.log('removeAnchors', anchors.length, '个marker丢失')
        
        // 隐藏丢失的marker对应的模型
        anchors.forEach(anchor => {
            const markerId = anchor.id
            console.log('removeAnchors 隐藏模型:', markerId)
            
            if (markerModels[markerId] && markerModels[markerId].model) {
                markerModels[markerId].model.visible = false
            }
        })
    })

    wx.showLoading({
        title: '请对准识别图...',
    });

    // 在session.start()成功后，session.addMarker()才会起作用。
    addMarkers()
}

// 添加所有marker
function addMarkers() {
    let completedCount = 0
    const totalMarkers = markerConfigs.length
    
    markerConfigs.forEach((config, index) => {
        // 从原始URL中提取文件扩展名
        let fileExtension = '.jpg'
        const urlParts = config.imageUrl.split('.')
        if (urlParts.length > 1) {
            const ext = urlParts[urlParts.length - 1].toLowerCase()
            if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
                fileExtension = '.' + ext
            }
        }
        
        // 如果文件路径包含新文件夹，则需要先创建文件夹。
        const fileName = `image_pattern_${index + 1}${fileExtension}`
        const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`
        
        console.log(`开始下载marker ${config.name}:`, config.imageUrl)
        
        wx.downloadFile({
            url: config.imageUrl,
            filePath,
            success: (res) => {
                console.log(`下载成功 ${config.name}:`, res.tempFilePath || filePath)
                
                // session.addMarker()需要等待session初始化完成，才能成功调用。
                try {
                    const markerId = session.addMarker(filePath)
                    console.log('addMarker成功', config.name, 'filePath:', filePath, 'markerId:', markerId)
                    
                    if (!markerId || markerId === -1) {
                        console.error('addMarker失败，返回的markerId无效:', markerId)
                        wx.showToast({
                            title: `${config.name} marker添加失败`,
                            icon: 'none',
                            duration: 2000
                        })
                    } else {
                        // 保存marker ID
                        markerIds.push(markerId)
                        
                        // 为每个marker加载对应的模型
                        loadModelForMarker(config, markerId)
                    }
                } catch (error) {
                    console.error('addMarker异常', config.name, error)
                    wx.showToast({
                        title: `${config.name} marker添加异常`,
                        icon: 'none',
                        duration: 2000
                    })
                }
                
                completedCount++
                if (completedCount >= totalMarkers) {
                    console.log('所有marker下载完成，共', totalMarkers, '个')
                    wx.hideLoading()
                }
            },
            fail: (err) => {
                console.error(`下载失败 ${config.name}:`, err)
                wx.showToast({
                    title: `下载${config.name}图片失败`,
                    icon: 'none',
                    duration: 3000
                })
                
                completedCount++
                if (completedCount >= totalMarkers) {
                    console.log('所有marker下载完成，共', totalMarkers, '个')
                    wx.hideLoading()
                }
            }
        })
    })
}

// 为特定marker加载模型
function loadModelForMarker(config, markerId) {
    var loader = new THREE.GLTFLoader();
    loader.load(config.modelUrl,
        function (gltf) {
            console.log('loadModelForMarker', config.name, 'success');
            
            var model = gltf.scene;
            // 应用配置的缩放
            model.scale.set(config.modelScale, config.modelScale, config.modelScale)
            
            // 应用位置偏移
            if (config.position) {
                model.position.set(config.position.x, config.position.y, config.position.z)
            }
            
            // 应用旋转
            if (config.rotation) {
                model.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z)
            }
            
            // 初始隐藏模型，只有识别到marker时才显示
            model.visible = false
            
            // 添加到场景
            scene.add(model)
            
            // 存储模型信息
            markerModels[markerId] = {
                model: model,
                config: config,
                animations: gltf.animations,
                originalScale: config.modelScale
            }
            
            // 如果有动画，创建动画
            if (config.animationName && gltf.animations) {
                createAnimationForMarker(model, gltf.animations, config.animationName, markerId)
            }
        },
        null,
        function (error) {
            console.log('loadModelForMarker', config.name, error);
        });
}

// 添加平面（用于显示识别到的marker位置）
function addPlane(config) {
    const geometry1 = new THREE.PlaneGeometry(config.planeSize.width, config.planeSize.height);
    const material1 = new THREE.MeshBasicMaterial({
        color: 'white',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
    });
    const plane1 = new THREE.Mesh(geometry1, material1);
    // 缩放
    plane1.scale.set(config.planeScale, config.planeScale, config.planeScale)
    // 旋转90度
    plane1.rotateX(-Math.PI / 2)
    // 初始隐藏，等到识别到marker时再显示
    plane1.visible = false
    return plane1;
}


// 加载3D模型（保留向后兼容，但推荐使用loadModelForMarker）
function loadModel(modelUrl, callback) {
    var loader = new THREE.GLTFLoader();
    wx.showLoading({
        title: 'Loading Model...',
    });
    loader.load(modelUrl,
        function (gltf) {
            console.log('loadModel', 'success');
            wx.hideLoading();
            var model = gltf.scene;
            // 默认缩放
            const defaultScale = 0.1;
            model.scale.set(defaultScale, defaultScale, defaultScale)
            mainModel = model;
            scene.add(mainModel)

            var animations = gltf.animations;
            if (callback) {
                callback(model, animations);
            }
        },
        null,
        function (error) {
            console.log('loadModel', error);
            wx.hideLoading();
            wx.showToast({
                title: 'Loading model failed.',
                icon: 'none',
                duration: 3000,
            });
        });
}

// 为特定marker创建动画
function createAnimationForMarker(model, animations, clipName, markerId) {
    if (!model || !animations) {
        return
    }

    // 动画混合器
    const mixer = new THREE.AnimationMixer(model)
    for (let i = 0; i < animations.length; i++) {
        const clip = animations[i]
        if (clip.name === clipName) {
            const action = mixer.clipAction(clip)
            action.play()
        }
    }

    // 将mixer存储到markerModels中
    if (markerModels[markerId]) {
        markerModels[markerId].mixer = mixer
    }
    mixers.push(mixer)
}

// 加载3D模型的动画
function createAnimation(model, animations, clipName) {
    if (!model || !animations) {
        return
    }

    // 动画混合器
    const mixer = new THREE.AnimationMixer(model)
    for (let i = 0; i < animations.length; i++) {
        const clip = animations[i]
        if (clip.name === clipName) {
            const action = mixer.clipAction(clip)
            action.play()
        }
    }

    mixers.push(mixer)
}

// 更新3D模型的动画
function updateAnimation() {
    const dt = clock.getDelta()
    if (mixers) {
        mixers.forEach(function (mixer) {
            mixer.update(dt)
        })
    }
}

// 在threejs的每帧渲染中，使用AR相机更新threejs相机的变换。
function render(frame) {
    // 更新threejs场景的背景
    webglBusiness.renderGL(frame)
    // 更新3D模型的动画
    updateAnimation()
    // 从ar每帧图像获取ar相机对象
    const ar_camera = frame.camera

    if (ar_camera) {
        // 更新three.js相机对象的视图矩阵
        camera.matrixAutoUpdate = false
        camera.matrixWorldInverse.fromArray(ar_camera.viewMatrix)
        camera.matrixWorld.getInverse(camera.matrixWorldInverse)

        // 更新three.js相机对象的投影矩阵
        const projectionMatrix = ar_camera.getProjectionMatrix(NEAR, FAR)
        camera.projectionMatrix.fromArray(projectionMatrix)
        camera.projectionMatrixInverse.getInverse(camera.projectionMatrix)
    }

    renderer.autoClearColor = false
    // 这个是three.js相机对象
    renderer.render(scene, camera)
    // 保留模型的正面和背面
    renderer.state.setCullFace(THREE.CullFaceNone)
}


function initTHREE() {
    THREE = createScopedThreejs(canvas)
    console.log('initTHREE')
    registerGLTFLoader(THREE)

    // 相机
    camera = new THREE.Camera()
    // 场景
    scene = new THREE.Scene()

    // 半球光
    const light1 = new THREE.HemisphereLight(0xffffff, 0x444444)
    light1.position.set(0, 0.2, 0)
    scene.add(light1)

    // 平行光
    const light2 = new THREE.DirectionalLight(0xffffff)
    light2.position.set(0, 0.2, 0.1)
    scene.add(light2)

    // 渲染层
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    })
    renderer.gammaOutput = true
    renderer.gammaFactor = 2.2

    // 动画需要的
    clock = new THREE.Clock()
}


// 调整画布的大小
function calcCanvasSize() {
    console.log('calcCanvasSize')

    const info = wx.getSystemInfoSync()
    devicePixelRatio = info.pixelRatio
    screenWidth = info.windowWidth
    screenHeight = info.windowHeight
    console.log('calcCanvasSize', 'screenWidth:', screenWidth, 'screenHeight:', screenHeight, 'devicePixelRatio:', devicePixelRatio)
    /* 官方示例的代码
    canvas.width = width * devicePixelRatio / 2
    canvas.height = height * devicePixelRatio / 2
    */
    renderer.setSize(screenWidth, screenHeight);
    renderer.setPixelRatio(devicePixelRatio);
    console.log('calcCanvasSize', 'canvas.width:', canvas.width, 'canvas.height:', canvas.height)
}

// 启动AR会话
function initEnvironment(canvasDom, callback) {
    console.log('initEnvironment')
    // 画布组件的对象
    canvas = canvasDom
    // 创建threejs场景
    initTHREE()
    // 创建AR会话
    session = wx.createVKSession({
        track: {
            marker: true,
        }
    })

    if (!session.addMarker) {
        wx.showModal({
            title: '提示',
            content: '由于该功能较新，需要微信版本号8.0.22以上运行。',
            showCancel: false,
            success: function (res) {
                // 用户点击确定
                if (res.confirm) {
                    wx.navigateBack()
                }
            },
        })
        return
    }

    // 开始AR会话
    session.start(err => {
        if (err) {
            console.log('session.start', err)
            return
        }
        console.log('session.start', 'ok')

        // 监视小程序窗口变化
        session.on('resize', function () {
            console.log('session on resize')
            calcCanvasSize()
        })

        if (callback) {
            callback()
        }

        // 设置画布的大小
        calcCanvasSize()
        // 初始化webgl的背景
        webglBusiness.initGL(renderer)
        // 每帧渲染
        const onFrame = function (timestamp) {
            console.log('onFrame', timestamp)
            if (!session) {
                return
            }

            // 从AR会话获取每帧图像
            const frame = session.getVKFrame(canvas.width, canvas.height)
            console.log('getVKFrame', frame ? 'success' : 'null')
            if (frame) {
                // threejs渲染过程
                render(frame)
            }
            session.requestAnimationFrame(onFrame)
        }
        session.requestAnimationFrame(onFrame)
    })
}

// 将对象回收
function dispose() {
    if (renderer) {
        renderer.dispose()
        renderer = null
    }
    if (scene) {
        scene.dispose()
        scene = null
    }
    if (camera) {
        camera = null
    }
    if (mainModel) {
        mainModel = null
    }
    
    // 清理所有marker模型
    if (markerModels) {
        Object.values(markerModels).forEach(markerData => {
            if (markerData.model) {
                markerData.model = null
            }
            if (markerData.mixer) {
                markerData.mixer.uncacheRoot(markerData.mixer.getRoot())
            }
        })
        markerModels = {}
    }

    if (mixers) {
        mixers.forEach(function (mixer) {
            mixer.uncacheRoot(mixer.getRoot())
        })
        mixers = []
    }
    if (clock) {
        clock = null
    }
    if (THREE) {
        THREE = null
    }

    if (canvas) {
        canvas = null
    }
    if (session) {
        session = null
    }

    if (reticle) {
        reticle = null
    }

    if (devicePixelRatio) {
        devicePixelRatio = null
    }

    if (screenWidth) {
        screenWidth = null
    }

    if (markerIds) {
        markerIds = []
    }

    webglBusiness.dispose()
}

module.exports = {
    render,
    initWorldTrack,
    initEnvironment,
    loadModel,
    createAnimation,
    updateAnimation,
    dispose,
    loadModelForMarker,
    createAnimationForMarker,
}
