import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { VisualDetailMode } from '../visualDetail';

type ShaderPlanetTheme = 'blue' | 'red';

interface ShaderPlanetProps {
    theme: ShaderPlanetTheme;
    spinDirection?: 1 | -1;
    isTurnActive?: boolean;
    motionSpeed?: number;
    detailMode?: VisualDetailMode;
    className?: string;
}

const THEME_PALETTE: Record<ShaderPlanetTheme, {
    low: string;
    mid: string;
    high: string;
    sparkle: string;
    rim: string;
}> = {
    blue: {
        low: '#082662',
        mid: '#1fb8ff',
        high: '#86ffe5',
        sparkle: '#38c4ff',
        rim: '#83f2ff'
    },
    red: {
        low: '#691338',
        mid: '#ff4f89',
        high: '#ff9e7d',
        sparkle: '#ff9bc0',
        rim: '#ffa4bd'
    }
};

const LIGHT_DIRECTION = new THREE.Vector3(-0.4, 0.55, 0.75).normalize();

const SURFACE_VERTEX_SHADER = `
varying vec2 vUvSphere;
varying vec3 vNormalWorld;

const float PI = 3.141592653589793;

void main() {
  vec3 unitPos = normalize(position);
  float lon = atan(unitPos.z, unitPos.x);
  float lat = asin(clamp(unitPos.y, -1.0, 1.0));

  vec3 displaced = position;

  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vNormalWorld = normalize(mat3(modelMatrix) * normal);
  vUvSphere = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const SURFACE_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uLowColor;
uniform vec3 uMidColor;
uniform vec3 uHighColor;
uniform vec3 uSparkleColor;
uniform vec3 uLightDir;
uniform float uDetailLevel;
varying vec2 vUvSphere;
varying vec3 vNormalWorld;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  float n = hash12(p);
  float m = hash12(p + 19.19);
  return vec2(n, m);
}

vec2 starField(vec2 uv, vec2 density, float rMin, float rMax, float speedBase) {
  vec2 gv = uv * density;
  vec2 id = floor(gv);
  vec2 f = fract(gv);
  float glow = 0.0;
  float flash = 0.0;

  for (int oy = -1; oy <= 1; oy++) {
    for (int ox = -1; ox <= 1; ox++) {
      vec2 offset = vec2(float(ox), float(oy));
      vec2 cellId = id + offset;
      vec2 rnd = hash22(cellId);

      vec2 starPos = offset + rnd;
      vec2 delta = f - starPos;
      float d = length(delta);

      float radius = mix(rMin, rMax, rnd.x);
      float breatheWave = 0.5 + 0.5 * sin(uTime * (0.64 + rnd.x * 0.92) + rnd.y * 6.28318);
      float breatheSize = mix(0.9, 1.12, breatheWave);
      float breatheEnergy = mix(0.72, 1.28, breatheWave);
      radius *= breatheSize;
      float core = 1.0 - smoothstep(radius * 0.22, radius, d);
      float halo = 1.0 - smoothstep(radius * 1.15, radius * 2.6, d);

      float twinkleSpeed = speedBase + rnd.y * 2.1;
      float twinkle = 0.88 + 0.12 * sin(uTime * twinkleSpeed + rnd.x * 6.28318);
      float flashSeed = rnd.x * 11.37 + rnd.y * 23.91;
      float flashPulse = pow(max(sin(uTime * (0.9 + rnd.x * 0.7) + flashSeed), 0.0), 24.0);
      float flashMask = step(0.86, rnd.y); // Only a small subset can flash white
      float flashContribution = flashPulse * flashMask;

      glow += (core * twinkle + halo * twinkle * 0.5) * breatheEnergy;
      flash += (core * flashContribution * 1.35 + halo * flashContribution * 0.42) * mix(0.92, 1.1, breatheWave);
    }
  }

  return vec2(glow, flash);
}

void main() {
  float latGradient = smoothstep(0.03, 0.97, vUvSphere.y);
  vec3 color = mix(uLowColor, uMidColor, latGradient * 0.62 + 0.18);
  color = mix(color, uHighColor, smoothstep(0.26, 0.9, latGradient));

  float light = dot(normalize(vNormalWorld), normalize(uLightDir)) * 0.5 + 0.5;
  color *= mix(0.74, 1.12, light);

  vec2 sparkleA = starField(vUvSphere, vec2(74.0, 46.0), 0.0032, 0.0066, 1.2);
  vec2 sparkleB = starField(vUvSphere + vec2(0.137, 0.241), vec2(98.0, 58.0), 0.0025, 0.0054, 1.45) * 0.88;
  vec2 sparkleC = vec2(0.0, 0.0);
  vec2 sparkleD = vec2(0.0, 0.0);
  vec2 sparkleE = vec2(0.0, 0.0);

  if (uDetailLevel > 0.5) {
    sparkleC = starField(vUvSphere + vec2(0.281, 0.073), vec2(30.0, 18.0), 0.007, 0.0135, 0.82) * 0.84;
  }
  if (uDetailLevel > 1.5) {
    sparkleD = starField(vUvSphere + vec2(0.413, 0.327), vec2(17.0, 10.0), 0.0105, 0.018, 0.68) * 1.08;
    sparkleE = starField(vUvSphere + vec2(0.519, 0.119), vec2(12.0, 7.0), 0.014, 0.024, 0.56) * 1.12;
  }

  float sparkle = clamp(sparkleA.x + sparkleB.x + sparkleC.x + sparkleD.x + sparkleE.x, 0.0, 3.7);
  float sparkleFlash = clamp(sparkleA.y + sparkleB.y + sparkleC.y + sparkleD.y + sparkleE.y, 0.0, 1.8);
  sparkle *= mix(0.56, 1.0, min(1.0, uDetailLevel * 0.5));
  sparkleFlash *= mix(0.45, 1.0, min(1.0, uDetailLevel * 0.5));
  vec3 sparkleColor = mix(uSparkleColor, uMidColor, 0.25);
  color += sparkleColor * sparkle * 0.98;
  color += vec3(1.0, 1.0, 1.0) * sparkleFlash * 0.72;

  gl_FragColor = vec4(color, 0.95);
}
`;

const RIM_VERTEX_SHADER = `
varying float vFresnel;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
  vFresnel = pow(1.0 - max(dot(worldNormal, viewDirection), 0.0), 2.4);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const RIM_FRAGMENT_SHADER = `
uniform vec3 uRimColor;
varying float vFresnel;

void main() {
  gl_FragColor = vec4(uRimColor, vFresnel * 0.55);
}
`;

const ShaderPlanet: React.FC<ShaderPlanetProps> = ({
    theme,
    spinDirection = 1,
    isTurnActive = false,
    motionSpeed = 1,
    detailMode = 'normal',
    className = ''
}) => {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const clampedMotionSpeed = Math.min(3, Math.max(0.4, motionSpeed));
    const motionSpeedRef = useRef(clampedMotionSpeed);
    const detailLevel = detailMode === 'ultra_low' ? 0 : detailMode === 'low' ? 1 : 2;

    useEffect(() => {
        motionSpeedRef.current = clampedMotionSpeed;
    }, [clampedMotionSpeed]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) {
            return;
        }

        const palette = THEME_PALETTE[theme];

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
        camera.position.set(0, 0, 3.35);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.className = 'shader-planet-canvas';
        root.appendChild(renderer.domElement);

        const surfaceUniforms = {
            uTime: { value: 0 },
            uLowColor: { value: new THREE.Color(palette.low) },
            uMidColor: { value: new THREE.Color(palette.mid) },
            uHighColor: { value: new THREE.Color(palette.high) },
            uSparkleColor: { value: new THREE.Color(palette.sparkle) },
            uLightDir: { value: LIGHT_DIRECTION.clone() },
            uDetailLevel: { value: detailLevel }
        };

        const surfaceMaterial = new THREE.ShaderMaterial({
            uniforms: surfaceUniforms,
            vertexShader: SURFACE_VERTEX_SHADER,
            fragmentShader: SURFACE_FRAGMENT_SHADER,
            transparent: true
        });

        const surfaceGeometry = new THREE.SphereGeometry(
            1,
            detailMode === 'ultra_low' ? 48 : detailMode === 'low' ? 96 : 192,
            detailMode === 'ultra_low' ? 32 : detailMode === 'low' ? 64 : 128
        );
        const surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
        scene.add(surfaceMesh);

        const rimUniforms = {
            uRimColor: { value: new THREE.Color(palette.rim) }
        };

        const rimMaterial = new THREE.ShaderMaterial({
            uniforms: rimUniforms,
            vertexShader: RIM_VERTEX_SHADER,
            fragmentShader: RIM_FRAGMENT_SHADER,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const rimGeometry = new THREE.SphereGeometry(
            1.04,
            detailMode === 'ultra_low' ? 32 : detailMode === 'low' ? 64 : 128,
            detailMode === 'ultra_low' ? 24 : detailMode === 'low' ? 48 : 96
        );
        const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);
        scene.add(rimMesh);

        const resize = () => {
            const rect = root.getBoundingClientRect();
            const size = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
            renderer.setPixelRatio(Math.min(
                window.devicePixelRatio || 1,
                detailMode === 'ultra_low' ? 1 : detailMode === 'low' ? 1.25 : 1.5
            ));
            renderer.setSize(size, size, false);
            camera.aspect = 1;
            camera.updateProjectionMatrix();
        };

        resize();
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(root);

        const clock = new THREE.Clock();
        let frameId = 0;
        let rotationY = 0;

        const renderFrame = () => {
            const delta = clock.getDelta();
            const elapsed = clock.elapsedTime;
            surfaceUniforms.uTime.value = elapsed;
            const detailSpinScale = detailMode === 'ultra_low' ? 0.52 : detailMode === 'low' ? 0.74 : 1;
            rotationY += delta * 0.24 * spinDirection * motionSpeedRef.current * detailSpinScale;
            surfaceMesh.rotation.y = rotationY;
            surfaceMesh.rotation.x = 0.12;
            rimMesh.rotation.y = surfaceMesh.rotation.y;
            rimMesh.rotation.x = surfaceMesh.rotation.x;
            renderer.render(scene, camera);
            frameId = window.requestAnimationFrame(renderFrame);
        };

        renderFrame();

        return () => {
            window.cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            scene.remove(surfaceMesh);
            scene.remove(rimMesh);
            surfaceGeometry.dispose();
            rimGeometry.dispose();
            surfaceMaterial.dispose();
            rimMaterial.dispose();
            renderer.dispose();
            if (renderer.domElement.parentElement === root) {
                root.removeChild(renderer.domElement);
            }
        };
    }, [detailLevel, detailMode, theme, spinDirection]);

    const detailStyle = detailMode === 'ultra_low'
        ? {
            ['--shader-planet-breathe-scale' as string]: '1.015',
            ['--shader-planet-breathe-duration' as string]: '10.2s',
            ['--shader-planet-halo-duration' as string]: '9.1s',
            ['--shader-planet-halo-min' as string]: '0.28',
            ['--shader-planet-halo-max' as string]: '0.44',
            ['--shader-planet-halo-scale-min' as string]: '0.98',
            ['--shader-planet-halo-scale-max' as string]: '1.03',
            ['--shader-planet-halo-blur-min' as string]: '6px',
            ['--shader-planet-halo-blur-max' as string]: '10px'
        }
        : detailMode === 'low'
            ? {
                ['--shader-planet-breathe-scale' as string]: '1.03',
                ['--shader-planet-breathe-duration' as string]: '8.8s',
                ['--shader-planet-halo-duration' as string]: '7.4s',
                ['--shader-planet-halo-min' as string]: '0.38',
                ['--shader-planet-halo-max' as string]: '0.58',
                ['--shader-planet-halo-scale-min' as string]: '0.98',
                ['--shader-planet-halo-scale-max' as string]: '1.06'
            }
            : undefined;

    return (
        <div
            ref={rootRef}
            className={`shader-planet shader-planet-${theme} ${isTurnActive ? 'shader-planet-turn-active' : ''} ${className}`.trim()}
            style={detailStyle}
            aria-hidden="true"
        />
    );
};

export default ShaderPlanet;
