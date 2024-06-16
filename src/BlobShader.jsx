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
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  const nearPlaneWidth =
    camera.near *
    Math.tan(MathUtils.degToRad(camera.fov / 2)) *
    camera.aspect *
    2
  const nearPlaneHeight = nearPlaneWidth / camera.aspect

  const mousePosition = useRef({ x: 0, y: 0 })

  const updateMousePosition = useCallback((e) => {
    mousePosition.current = { x: e.pageX, y: e.pageY }
  }, [])

  const noiseTexture = useTexture("./textures/noise.png")

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

  useEffect(() => {
    const object = meshRef.current

    if (object) {
      object.updateMatrixWorld()
      const worldMatrix = object.matrixWorld
      const inverseMatrix = new Matrix4().copy(worldMatrix).invert()
      setWorldToObjectMatrix(inverseMatrix)
      console.log("World to Object Matrix:", inverseMatrix)
      meshRef.current.material.uniforms.uInverseModelMat.value = inverseMatrix
      meshRef.current.updateMatrixWorld()
    }
  }, [
    meshRef.current?.position,
    meshRef.current?.rotation,
    meshRef.current?.scale,
  ])

  useEffect(() => {
    window.addEventListener("mousemove", updateMousePosition, false)
    console.log("mousePosition", mousePosition)
    return () => {
      window.removeEventListener("mousemove", updateMousePosition, false)
    }
  }, [updateMousePosition])

  let cameraForwardPos = new Vector3(0, 0, -1)

  useFrame((state) => {
    let time = state.clock.getElapsedTime()

    if (meshRef.current) {
    }

    // Update the uniform

    meshRef.current.material.uniforms.uCamPos.value = camera.position
    // meshRef.current.material.uniforms.uMouse.value = new Vector2(0, 0)

    meshRef.current.material.uniforms.uMouse.value = new Vector2(
      mousePosition.current.x,
      mousePosition.current.y
    )

    meshRef.current.material.uniforms.uTime.value = time * speed
    meshRef.current.material.uniforms.uReflection.value = reflection
    meshRef.current.material.uniforms.uSpeed.value = speed
    meshRef.current.material.uniforms.uIOR.value = IOR
    meshRef.current.material.uniforms.uCount.value = count
    meshRef.current.material.uniforms.uSize.value = size
    meshRef.current.material.uniforms.uDispersion.value = dispersion
    meshRef.current.material.uniforms.uRefractPower.value = refract
    meshRef.current.material.uniforms.uChromaticAbberation.value =
      chromaticAbberation

    // FBO
    state.gl.setRenderTarget(buffer)
    state.gl.setClearColor("#d8d7d7")
    state.gl.render(scene, state.camera)
    state.gl.setRenderTarget(null)
  })

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
        value: new Vector2(viewport.width, viewport.height).multiplyScalar(
          Math.min(window.devicePixelRatio, 2)
        ),
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
    }),
    [viewport.width, viewport.height, buffer.texture]
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
