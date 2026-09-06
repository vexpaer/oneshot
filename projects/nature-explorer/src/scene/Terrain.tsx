import { useMemo } from "react";
import * as THREE from "three";
import { terrainHeight, U, GLSL_NOISE } from "../world/world";
import { useStore } from "../world/store";

export function Terrain() {
  const quality = useStore((s) => s.quality);
  const geo = useMemo(() => {
    const seg = quality === "high" ? 190 : 110;
    const g = new THREE.PlaneGeometry(240, 240, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
    }
    g.computeVertexNormals();
    return g;
  }, [quality]);

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uSeason = U.uSeason;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos; varying vec3 vWNormal;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNormal = normalize(mat3(modelMatrix) * objectNormal);`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform vec4 uSeason; varying vec3 vWPos; varying vec3 vWNormal;
          ${GLSL_NOISE}`
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          {
            float n = vnoise(vWPos.xz * 0.35) * 0.6 + vnoise(vWPos.xz * 1.9) * 0.4;
            float n2 = vnoise(vWPos.xz * 0.08 + 3.0);
            float slope = 1.0 - clamp(vWNormal.y, 0.0, 1.0);
            vec3 gSpring = vec3(0.40, 0.60, 0.28);
            vec3 gSummer = vec3(0.25, 0.44, 0.18);
            vec3 gAutumn = vec3(0.56, 0.45, 0.22);
            vec3 gWinter = vec3(0.62, 0.64, 0.62);
            vec3 grass = gSpring * uSeason.x + gSummer * uSeason.y + gAutumn * uSeason.z + gWinter * uSeason.w;
            grass *= 0.82 + 0.36 * n;
            grass = mix(grass, grass * vec3(0.9, 0.85, 0.7), n2 * 0.5);
            vec3 dirt = vec3(0.30, 0.23, 0.16) * (0.8 + 0.4 * n);
            vec3 rock = vec3(0.40, 0.39, 0.38) * (0.8 + 0.4 * n);
            vec3 sand = vec3(0.50, 0.45, 0.35);
            vec3 col = grass;
            col = mix(col, dirt, smoothstep(0.16, 0.38, slope + (n - 0.5) * 0.12));
            col = mix(col, rock, smoothstep(0.42, 0.68, slope));
            // shore + lake bed
            float shore = 1.0 - smoothstep(-1.25, -0.55, vWPos.y);
            col = mix(col, sand, shore * 0.85);
            col = mix(col, vec3(0.16, 0.19, 0.16), 1.0 - smoothstep(-3.6, -1.4, vWPos.y));
            // altitude rock
            col = mix(col, rock, smoothstep(13.0, 24.0, vWPos.y + (n - 0.5) * 3.0) * smoothstep(0.02, 0.12, slope));
            // snow
            float snowMask = smoothstep(0.55, 0.82, vWNormal.y + (n - 0.5) * 0.25) * smoothstep(-1.3, -0.7, vWPos.y);
            float snow = uSeason.w * snowMask;
            col = mix(col, vec3(0.90, 0.92, 0.96) * (0.9 + 0.1 * n), snow);
            diffuseColor.rgb *= col;
          }`
        )
        .replace(
          "#include <roughnessmap_fragment>",
          `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.55, uSeason.w * 0.6 * smoothstep(0.55, 0.82, vWNormal.y));`
        );
    };
    return m;
  }, []);

  return <mesh geometry={geo} material={mat} receiveShadow castShadow={false} />;
}
