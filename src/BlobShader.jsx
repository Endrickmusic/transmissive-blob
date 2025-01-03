import {
  useCubeTexture,
  useTexture,
  useFBO,
  Image,
  OrbitControls,
} from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef, useMemo, useEffect, useCallback, useState } from "react"
import { useControls } from "leva"

import vertexShader from "./shaders/vertexShader.js"
import fragmentShader from "./shaders/fragmentShader.js"
import { Vector2, Vector3, MathUtils, Matrix4 } from "three"

export default function Shader() {
  const meshRef = useRef()
  const buffer = useFBO()
  const viewport = useThree((state) => state.viewport)
  const camera = useThree((state) => state.camera)

  // mouse position
  const mousePosition = useRef({ x: 0, y: 0 })

  const updateMousePosition = useCallback((e) => {
    mousePosition.current = {
      x: (e.clientX / window.innerWidth) * 2 - 1,
      y: -(e.clientY / window.innerHeight) * 2 + 1,
    }
  }, [])

  // textures
  const noiseTexture = useTexture(
    "./textures/noise.png",
    (texture) => {
      texture.needsUpdate = true
    },
    undefined,
    (error) => {
      console.error("Error loading noise texture:", error)
    }
  )

  const cubeTexture = useCubeTexture(
    ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"],
    { path: "./cubemap/potsdamer_platz/" }
  )

  const [worldToObjectMatrix, setWorldToObjectMatrix] = useState(new Matrix4())

  const {
    reflection,
    speed,
    IOR,
    count,
    size,
    dispersion,
    refract,
    chromaticAbberation,
  } = useControls({
    reflection: {
      value: 1.5,
      min: 0.01,
      max: 6.0,
      step: 0.1,
    },
    speed: {
      value: 0.5,
      min: 0.01,
      max: 3.0,
      step: 0.01,
    },
    IOR: {
      value: 0.84,
      min: 0.01,
      max: 2.0,
      step: 0.01,
    },
    count: {
      value: 3,
      min: 1,
      max: 20,
      step: 1,
    },
    size: {
      value: 1.0,
      min: 0.1,
      max: 2.5,
      step: 0.01,
    },
    dispersion: {
      value: 0.03,
      min: 0.0,
      max: 0.1,
      step: 0.001,
    },
    refract: {
      value: 0.15,
      min: 0.0,
      max: 2.0,
      step: 0.1,
    },
    chromaticAbberation: {
      value: 0.5,
      min: 0.0,
      max: 5.0,
      step: 0.1,
    },
  })

  // world to object matrix
  useEffect(() => {
    const object = meshRef.current
    if (object) {
      const updateMatrix = () => {
        object.updateMatrixWorld()
        const inverseMatrix = new Matrix4().copy(object.matrixWorld).invert()
        setWorldToObjectMatrix(inverseMatrix)
        object.material.uniforms.uInverseModelMat.value = inverseMatrix
      }

      updateMatrix()
      return () => {
        object.material.uniforms.uInverseModelMat.value = new Matrix4()
      }
    }
  }, [])

  // mouse position
  useEffect(() => {
    window.addEventListener("mousemove", updateMousePosition, false)
    console.log("mousePosition", mousePosition)
    return () => {
      window.removeEventListener("mousemove", updateMousePosition, false)
    }
  }, [updateMousePosition])

  // render loop
  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    let time = state.clock.getElapsedTime()

    mesh.material.uniforms.uCamPos.value = camera.position
    mesh.material.uniforms.uMouse.value = new Vector2(
      mousePosition.current.x,
      mousePosition.current.y
    )

    mesh.material.uniforms.uTime.value = time * speed
    mesh.material.uniforms.uReflection.value = reflection
    mesh.material.uniforms.uSpeed.value = speed
    mesh.material.uniforms.uIOR.value = IOR
    mesh.material.uniforms.uCount.value = count
    mesh.material.uniforms.uSize.value = size
    mesh.material.uniforms.uDispersion.value = dispersion
    mesh.material.uniforms.uRefractPower.value = refract
    mesh.material.uniforms.uChromaticAbberation.value = chromaticAbberation
  })

  // Create a ref for resolution to avoid recreating Vector2 on every frame
  const resolutionRef = useRef(new Vector2())

  // Handle resolution updates
  useEffect(() => {
    const updateResolution = () => {
      if (meshRef.current?.material) {
        resolutionRef.current
          .set(viewport.width, viewport.height)
          .multiplyScalar(Math.min(window.devicePixelRatio, 2))

        meshRef.current.material.uniforms.uResolution.value =
          resolutionRef.current
      }
    }

    window.addEventListener("resize", updateResolution)
    updateResolution() // Initial set

    return () => window.removeEventListener("resize", updateResolution)
  }, [viewport.width, viewport.height])

  // Define the shader uniforms with memoization to optimize performance
  const uniforms = useMemo(
    () => ({
      uCamPos: { value: camera.position },
      uCamToWorldMat: { value: camera.matrixWorld },
      uCamInverseProjMat: { value: camera.projectionMatrixInverse },
      uInverseModelMat: {
        value: new Matrix4(),
      },
      uTime: {
        type: "f",
        value: 1.0,
      },
      uMouse: {
        type: "v2",
        value: new Vector2(0, 0),
      },
      uResolution: {
        type: "v2",
        value: resolutionRef.current,
      },
      uTexture: {
        type: "sampler2D",
        value: buffer.texture,
      },
      uNoiseTexture: {
        type: "sampler2D",
        value: noiseTexture,
      },
      iChannel0: {
        type: "samplerCube",
        value: cubeTexture,
      },
      uSpeed: {
        type: "f",
        value: speed,
      },
      uIOR: {
        type: "f",
        value: IOR,
      },
      uCount: {
        type: "i",
        value: count,
      },
      uReflection: {
        type: "f",
        value: reflection,
      },
      uSize: {
        type: "f",
        value: size,
      },
      uDispersion: {
        type: "f",
        value: dispersion,
      },
      uRefractPower: {
        type: "f",
        value: refract,
      },
      uChromaticAbberation: {
        type: "f",
        value: chromaticAbberation,
      },
      uLightPos: {
        type: "v3",
        value: new Vector3(0, 10, 0),
      },
    }),
    [
      buffer.texture,
      noiseTexture,
      cubeTexture,
      speed,
      IOR,
      count,
      reflection,
      size,
      dispersion,
      refract,
      chromaticAbberation,
    ]
  )

  return (
    <>
      <OrbitControls />

      <mesh position={[0, 0.5, -4]} rotation={[2, 4, 1]}>
        <boxGeometry />
        <meshNormalMaterial />
      </mesh>

      <mesh ref={meshRef} scale={[2, 2, 2]} position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent={true}
        />
      </mesh>
    </>
  )
}
