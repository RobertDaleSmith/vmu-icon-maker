// Scene setup
const biosTexture = 'data:image/png;base64,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';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    alpha: true,  // Enable transparency
    antialias: true  // Optional: makes edges smoother
});
renderer.setClearColor(0x000000, 0); // Set clear color to transparent
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('dreamcast-background').appendChild(renderer.domElement);

// Create plane geometry with texture
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load(biosTexture);
const geometry = new THREE.PlaneGeometry(50, 30, 100, 100);
const material = new THREE.MeshPhongMaterial({
    map: texture,
    side: THREE.DoubleSide,
    shininess: 1,
    specular: 0x444444,
    transparent: true,  // Enable transparency
    opacity: 1,        // Start fully opaque
    alphaTest: 0.1     // Help with transparency rendering
});
const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

// Add cylinder shape
function createCylinder() {
    const points = [];
    const segments = 64;
    const height = 70;
    const radius = 40;  // constant radius for perfect circle
    
    // Create points for the circle shape
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        points.push(new THREE.Vector2(radius, height * t));
    }

    const texture = textureLoader.load(biosTexture);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    texture.offset.set(1, 1);

    // Create custom shader material for gradient transparency
    const material = new THREE.ShaderMaterial({
        uniforms: {
            map: { value: texture },
            gradientStart: { value: -0.7 }, // Adjust where the fade starts (0-1)
            gradientEnd: { value: 1.1 }    // Adjust where the fade ends (0-1)
        },
        vertexShader: `
            varying vec2 vUv;
            varying float vY;
            
            void main() {
                vUv = uv;
                vY = position.y;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D map;
            uniform float gradientStart;
            uniform float gradientEnd;
            
            varying vec2 vUv;
            varying float vY;
            
            void main() {
                vec4 texColor = texture2D(map, vUv);
                
                // Calculate opacity based on y position
                float normalizedY = vY / 60.0; // Normalize based on height
                float opacity = 1.0 - smoothstep(gradientStart, gradientEnd, normalizedY);
                
                gl_FragColor = vec4(texColor.rgb, texColor.a * opacity);
            }
        `,
        side: THREE.DoubleSide,
        transparent: true
    });

    const geometry = new THREE.LatheGeometry(points, 32);
    const cylinder = new THREE.Mesh(geometry, material);

    // Rotate 180 degrees to make it upside down
    cylinder.rotation.x = Math.PI/0.655;
    // Position it above the wave
    cylinder.position.set(0, 0, 65);
    // Scale to desired size
    cylinder.scale.set(1, 1, 1);

    return cylinder;
}

const cylinder = createCylinder();
scene.add(cylinder);

// Add lights
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

const directionalLightCylinder = new THREE.DirectionalLight(0xffffff, 1);
directionalLightCylinder.position.set(1, -15, 1);
scene.add(directionalLightCylinder);

// Position camera at 45 degrees
camera.position.set(0, -20, 7);
camera.lookAt(0, 100, 0);

// Wave parameters
const waves = [];
const numWaves = 4;  // Reduced number of waves
for (let i = 0; i < numWaves; i++) {
    waves.push({
        amplitude: 0.6 * (0.9 - i/numWaves),
        frequency: 0.6,
        speed: 1,
        phase: i * Math.PI / 16  // Adjusted phase difference
    });
}

let time = 0;

// Calculate height and opacity at point
function getHeightAt(x, y) {
    const distance = Math.sqrt(x*x + y*y);
    const fadeStart = 0;
    const fadeEnd = 20;

    // Calculate opacity based on distance
    let opacity = 1.0;
    if (distance > fadeStart) {
        opacity = Math.max(0, 1.0 - (distance - fadeStart) / (fadeEnd - fadeStart));
    }

    // Smooth center transition
    const centerRadius = 3;  // Radius of the smooth center area
    const centerFactor = Math.min(1, distance / centerRadius);
    
    return {
        height: waves.reduce((sum, wave) => {
            // Apply smooth center transition and gentler wave motion
            return sum + wave.amplitude * 
                   Math.sin(distance * wave.frequency - time * wave.speed + wave.phase) *
                   Math.exp(-distance * 0.15) *
                   centerFactor;
        }, 0),
        opacity: opacity
    };
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Existing wave animation
    const positions = geometry.attributes.position.array;
    const opacities = new Float32Array(positions.length / 3);
    
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 1];
        const result = getHeightAt(x, z);
        
        positions[i + 2] = result.height;
        opacities[i/3] = result.opacity;
    }
    
    // Rotate cylinder
    cylinder.rotation.y -= 0.001; // Adjust rotation speed here
    
    geometry.attributes.position.needsUpdate = true;
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    // Create custom shader material if it doesn't exist
    if (!material.userData.opacityShader) {
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                '#include <common>\nattribute float opacity;\nvarying float vOpacity;'
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nvOpacity = opacity;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                '#include <common>\nvarying float vOpacity;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
                'gl_FragColor = vec4( outgoingLight, diffuseColor.a * vOpacity );'
            );
            material.userData.opacityShader = shader;
        };
        material.needsUpdate = true;
    }

    time += 0.016;
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

animate();

// Add this function to update the clock
function updateClock() {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
    }).replace(/\//g, '/');
    const time = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });
    
    document.getElementById('clock').innerHTML = `${date}&nbsp;&nbsp;${time}`;
}

// Update clock immediately and then every second
updateClock();
setInterval(updateClock, 1000);
