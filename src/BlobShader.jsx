import { useCubeTexture, useFBO, Image } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef, useMemo, useEffect, useCallback } from "react"
import { useControls } from "leva"

import vertexShader from "./shaders/vertexShader.js"
import fragmentShader from "./shaders/dispersionFragShader.js"
import { DoubleSide, Vector2 } from "three"

export default function Shader() {
  const meshRef = useRef()
  const buffer = useFBO()
  // const texture01 = useTexture("./textures/clouds_02.png")
  const viewport = useThree((state) => state.viewport)
  const scene = useThree((state) => state.scene)

  const mousePosition = useRef({ x: 0, y: 0 })

  const updateMousePosition = useCallback((e) => {
    mousePosition.current = { x: e.pageX, y: e.pageY }
  }, [])

  const cubeTexture = useCubeTexture(
    ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"],
    { path: "./cubemap/potsdamer_platz/" }
  )

  const { dispersionOffset, speed, lensZoom, count } = useControls({
    dispersionOffset: {
      value: 0.0095,
      min: 0.001,
      max: 0.04,
      step: 0.001,
    },
    speed: {
      value: 1.0,
      min: 0.01,
      max: 3.0,
      step: 0.01,
    },
    lensZoom: {
      value: 0.5,
      min: 0.01,
      max: 1.0,
      step: 0.01,
    },
    count: {
      value: 3,
      min: 1,
      max: 20,
      step: 1,
    },
  })

  useEffect(() => {
    window.addEventListener("mousemove", updateMousePosition, false)
    console.log("mousePosition", mousePosition)
    return () => {
      window.removeEventListener("mousemove", updateMousePosition, false)
    }
  }, [updateMousePosition])

  useFrame((state) => {
    let time = state.clock.getElapsedTime()

    // console.log("mousePosition", mousePosition.current)

    // meshRef.current.material.uniforms.uMouse.value = new Vector2(0, 0)
    meshRef.current.material.uniforms.uMouse.value = new Vector2(
      mousePosition.current.x,
      mousePosition.current.y
    )

    meshRef.current.material.uniforms.uTime.value = time * speed
    meshRef.current.material.uniforms.dispersionOffset.value = dispersionOffset
    meshRef.current.material.uniforms.lensZoom.value = lensZoom
    meshRef.current.material.uniforms.count.value = count

    // Tie lens to the pointer
    // getCurrentViewport gives us the width & height that would fill the screen in threejs units
    // By giving it a target coordinate we can offset these bounds, for instance width/height for a plane that
    // sits 15 units from 0/0/0 towards the camera (which is where the lens is)
    const viewportFBO = state.viewport.getCurrentViewport(
      state.camera,
      [0, 0, 15]
    )

    // This is entirely optional but spares us one extra render of the scene
    // The createPortal below will mount the children of <Lens> into the new THREE.Scene above
    // The following code will render that scene into a buffer, whose texture will then be fed into
    // a plane spanning the full screen and the lens transmission material
    state.gl.setRenderTarget(buffer)
    state.gl.setClearColor("#d8d7d7")
    state.gl.render(scene, state.camera)
    state.gl.setRenderTarget(null)
  })

  // Define the shader uniforms with memoization to optimize performance
  const uniforms = useMemo(
    () => ({
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
        value: new Vector2(viewport.width, viewport.height),
      },
      texture01: {
        type: "sampler2D",
        value: buffer.texture,
      },
      iChannel0: {
        type: "samplerCube",
        value: cubeTexture,
      },
      dispersionOffset: {
        type: "f",
        value: dispersionOffset,
      },
      lensZoom: {
        type: "f",
        value: lensZoom,
      },
      count: {
        type: "i",
        value: count,
      },
    }),
    [viewport.width, viewport.height, buffer.texture]
  )

  return (
    <>
      {/* <Image url="./images/clouds.jpg" scale={2} /> */}

      <mesh position={[0, 0.5, -4]} rotation={[2, 4, 1]}>
        <boxGeometry />
        <meshNormalMaterial />
      </mesh>

      <mesh ref={meshRef} scale={[viewport.width, viewport.height, 1]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          side={DoubleSide}
          transparent={true}
        />
      </mesh>
    </>
  )
}
