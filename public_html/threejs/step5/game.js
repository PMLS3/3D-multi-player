class Game{
	constructor(){
		if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
		
		this.container;
		this.player = { };
        this.animations = {};
		this.stats;
		this.camera;
		this.scene;
		this.renderer;
		
		this.container = document.createElement( 'div' );
		this.container.style.height = '100%';
		document.body.appendChild( this.container );
        
		const game = this;
		this.anims = ['Walking', 'Walking Backwards', 'Turn', 'Running', 'Pointing Gesture'];
        
		this.assetsPath = '../assets/';
		
		this.clock = new THREE.Clock();
        
        this.init();

		window.onError = function(error){
			console.error(JSON.stringify(error));
		}
	}
	
	init() {

		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 5000 );
		this.camera.position.set(112, 100, 600);
        
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0xa0a0a0 );
		this.scene.fog = new THREE.Fog( 0xa0a0a0, 700, 4000 );

		let light = new THREE.HemisphereLight( 0xffffff, 0x444444 );
		light.position.set( 0, 200, 0 );
		this.scene.add( light );

        const shadowSize = 200;
		light = new THREE.DirectionalLight( 0xffffff );
		light.position.set( 0, 200, 100 );
		light.castShadow = true;
		light.shadow.camera.top = shadowSize;
		light.shadow.camera.bottom = -shadowSize;
		light.shadow.camera.left = -shadowSize;
		light.shadow.camera.right = shadowSize;
        this.sun = light;
		this.scene.add( light );

		// ground
		var mesh = new THREE.Mesh( new THREE.PlaneBufferGeometry( 10000, 10000 ), new THREE.MeshPhongMaterial( { color: 0x999999, depthWrite: false } ) );
		mesh.rotation.x = - Math.PI / 2;
		//mesh.position.y = -100;
		mesh.receiveShadow = true;
		this.scene.add( mesh );

		var grid = new THREE.GridHelper( 5000, 40, 0x000000, 0x000000 );
		//grid.position.y = -100;
		grid.material.opacity = 0.2;
		grid.material.transparent = true;
		this.scene.add( grid );

		// model
		const loader = new THREE.FBXLoader();
		const game = this;
		
		loader.load( `${this.assetsPath}fbx/people/FireFighter.fbx`, function ( object ) {

			object.mixer = new THREE.AnimationMixer( object );
			game.player.mixer = object.mixer;
			game.player.root = object.mixer.getRoot();
			
			object.name = "FireFighter";
					
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					child.castShadow = true;
					child.receiveShadow = false;		
				}
			} );
			
            const tLoader = new THREE.TextureLoader();
            tLoader.load(`${game.assetsPath}images/SimplePeople_FireFighter_Brown.png`, function(texture){
				object.traverse( function ( child ) {
					if ( child.isMesh ){
						child.material.map = texture;
					}
				} );
			});
            
            game.player.object = new THREE.Object3D();
			game.scene.add(game.player.object);
			game.player.object.add(object);
			game.animations.Idle = object.animations[0];
            
            game.loadNextAnim(loader);
		} );
		
		this.renderer = new THREE.WebGLRenderer( { antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.shadowMap.enabled = true;
		this.container.appendChild( this.renderer.domElement );
        
		window.addEventListener( 'resize', function(){ game.onWindowResize(); }, false );
	}
	
    loadNextAnim(loader){
		let anim = this.anims.pop();
		const game = this;
		loader.load( `${this.assetsPath}fbx/anims/${anim}.fbx`, function( object ){
			game.animations[anim] = object.animations[0];
			if (game.anims.length>0){
				game.loadNextAnim(loader);
			}else{
                game.createCameras();
                game.joystick = new JoyStick({
                    onMove: game.playerControl,
                    game: game
                });
				delete game.anims;
				game.action = "Idle";
				game.animate();
			}
		});	
	}
    
    movePlayer(dt){	
        if (this.player.move.forward>0){
            const speed = (this.player.action=='Running') ? 400 : 150;
            this.player.object.translateZ(dt*speed);
        }else{
            this.player.object.translateZ(-dt*30);
        }
        this.player.object.rotateY(this.player.move.turn*dt);
	}
    
	onWindowResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

    set action(name){
		const action = this.player.mixer.clipAction( this.animations[name] );
        action.time = 0;
		this.player.mixer.stopAllAction();
		this.player.action = name;
		this.player.actionTime = Date.now();
		
		action.fadeIn(0.5);	
		action.play();
	}
    
    get action(){
        if (this.player===undefined || this.player.actionName===undefined) return "";
        return this.player.action;
    }
    
    playerControl(forward, turn){
		turn = -turn;
		
		if (forward>0.3){
			if (this.player.action!='Walking' && this.player.action!='Running') this.action = 'Walking';
		}else if (forward<-0.3){
			if (this.player.action!='Walking Backwards') this.action = 'Walking Backwards';
		}else{
			forward = 0;
			if (Math.abs(turn)>0.1){
				if (this.player.action != 'Turn') this.action = 'Turn';
			}else if (this.player.action!="Idle"){
				this.action = 'Idle';
			}
		}
		
		if (forward==0 && turn==0){
			delete this.player.move;
		}else{
			this.player.move = { forward, turn }; 
		}
	}
    
    set activeCamera(object){
		this.player.cameras.active = object;
	}
    
    createCameras(){
		const offset = new THREE.Vector3(0, 80, 0);
		const front = new THREE.Object3D();
		front.position.set(112, 100, 600);
		front.parent = this.player.object;
		const back = new THREE.Object3D();
		back.position.set(0, 300, -600);
		back.parent = this.player.object;
		const wide = new THREE.Object3D();
		wide.position.set(178, 139, 1665);
		wide.parent = this.player.object;
		const overhead = new THREE.Object3D();
		overhead.position.set(0, 400, 0);
		overhead.parent = this.player.object;
		const collect = new THREE.Object3D();
		collect.position.set(40, 82, 94);
		collect.parent = this.player.object;
		this.player.cameras = { front, back, wide, overhead, collect };
		game.activeCamera = this.player.cameras.back;	
	}
    
	animate() {
		const game = this;
		const dt = this.clock.getDelta();
		
		requestAnimationFrame( function(){ game.animate(); } );
		
		if (this.player.mixer!==undefined) this.player.mixer.update(dt);
		
        if (this.player.action=='Walking'){
			const elapsedTime = Date.now() - this.player.actionTime;
			if (elapsedTime>1000 && this.player.move.forward>0){
				this.action = 'Running';
			}
		}
		
		if (this.player.move !== undefined) this.movePlayer(dt);
		
		if (this.player.cameras!=undefined && this.player.cameras.active!=undefined){
			this.camera.position.lerp(this.player.cameras.active.getWorldPosition(new THREE.Vector3()), 0.05);
			const pos = this.player.object.position.clone();
			pos.y += 200;
			this.camera.lookAt(pos);
		}
        
        if (this.sun != undefined){
            this.sun.position.x = this.player.object.position.x;
            this.sun.position.y = this.player.object.position.y + 200;
            this.sun.position.z = this.player.object.position.z + 100;
            this.sun.target = this.player.object;
        }
        
		this.renderer.render( this.scene, this.camera );

	}
}