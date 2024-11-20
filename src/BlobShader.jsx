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
import { Vector2, Vector3, Matrix4 } from "three"

export default function Shader() {
  const meshRef = useRef()
  const buffer = useFBO()
  const viewport = useThree((state) => state.viewport)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)

  // Memoize mouse position handler
  const mousePosition = useRef({ x: 0, y: 0 })
  const updateMousePosition = useCallback((e) => {
    mousePosition.current = { x: e.pageX, y: e.pageY }
  }, [])

  // Memoize textures
  const noiseTexture = useTexture("./textures/noise.png")
  const cubeTexture = useCubeTexture(
    ["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"],
    { path: "./cubemap/potsdamer_platz/" }
  )

  // Memoize controls
  const controls = useControls({
    reflection: { value: 1.5, min: 0.01, max: 6.0, step: 0.1 },
    speed: { value: 0.5, min: 0.01, max: 3.0, step: 0.01 },
    IOR: { value: 0.84, min: 0.01, max: 2.0, step: 0.01 },
    count: { value: 3, min: 1, max: 20, step: 1 },
    size: { value: 1.0, min: 0.1, max: 2.5, step: 0.01 },
    dispersion: { value: 0.03, min: 0.0, max: 0.1, step: 0.001 },
    refract: { value: 0.15, min: 0.0, max: 2.0, step: 0.1 },
    chromaticAbberation: { value: 0.5, min: 0.0, max: 5.0, step: 0.1 },
  })

  // Matrix update effect
  useEffect(() => {
    const object = meshRef.current
    if (!object) return

    object.updateMatrixWorld()
    const inverseMatrix = new Matrix4().copy(object.matrixWorld).invert()
    object.material.uniforms.uInverseModelMat.value = inverseMatrix
  }, [
    meshRef.current?.position,
    meshRef.current?.rotation,
    meshRef.current?.scale,
  ])

  // Mouse event listener
  useEffect(() => {
    window.addEventListener("mousemove", updateMousePosition, false)
    return () =>
      window.removeEventListener("mousemove", updateMousePosition, false)
  }, [updateMousePosition])

  // Optimized render loop
  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return

    const time = state.clock.getElapsedTime()
    const uniforms = mesh.material.uniforms

    // Batch uniform updates
    Object.assign(uniforms, {
      uCamPos: { value: camera.position },
      uMouse: {
        value: new Vector2(mousePosition.current.x, mousePosition.current.y),
      },
      uTime: { value: time * controls.speed },
      uReflection: { value: controls.reflection },
      uSpeed: { value: controls.speed },
      uIOR: { value: controls.IOR },
      uCount: { value: controls.count },
      uSize: { value: controls.size },
      uDispersion: { value: controls.dispersion },
      uRefractPower: { value: controls.refract },
      uChromaticAbberation: { value: controls.chromaticAbberation },
    })

    // FBO rendering
    gl.setRenderTarget(buffer)
    gl.setClearColor("#d8d7d7")
    gl.render(scene, camera)
    gl.setRenderTarget(null)
  })

  // Memoized uniforms
  const uniforms = useMemo(
    () => ({
      uCamPos: { value: camera.position },
      uCamToWorldMat: { value: camera.matrixWorld },
      uCamInverseProjMat: { value: camera.projectionMatrixInverse },
      uInverseModelMat: { value: new Matrix4() },
      uTime: { type: "f", value: 1.0 },
      uMouse: { type: "v2", value: new Vector2(0, 0) },
      uResolution: {
        type: "v2",
        value: new Vector2(viewport.width, viewport.height).multiplyScalar(
          Math.min(window.devicePixelRatio, 2)
        ),
      },
      uTexture: { type: "sampler2D", value: buffer.texture },
      uNoiseTexture: { type: "sampler2D", value: noiseTexture },
      iChannel0: { type: "samplerCube", value: cubeTexture },
      uSpeed: { type: "f", value: controls.speed },
      uIOR: { type: "f", value: controls.IOR },
      uCount: { type: "i", value: controls.count },
      uReflection: { type: "f", value: controls.reflection },
      uSize: { type: "f", value: controls.size },
      uDispersion: { type: "f", value: controls.dispersion },
      uRefractPower: { type: "f", value: controls.refract },
      uChromaticAbberation: { type: "f", value: controls.chromaticAbberation },
    }),
    [viewport, buffer.texture, camera, cubeTexture, noiseTexture, controls]
  )

  // Optimized resize handler
  useEffect(() => {
    const handleResize = debounce(() => {
      if (meshRef.current?.material) {
        meshRef.current.material.uniforms.uResolution.value.set(
          viewport.width * Math.min(window.devicePixelRatio, 2),
          viewport.height * Math.min(window.devicePixelRatio, 2)
        )
      }
    }, 100)

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [viewport])

  return (
    <>
      <OrbitControls />
      <mesh position={[0, 0.5, -4]} rotation={[2, 4, 1]}>
        <boxGeometry />
        <meshNormalMaterial />
      </mesh>
      <mesh ref={meshRef} scale={2} position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
        />
      </mesh>
    </>
  )
}

// Utility function for debouncing
function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), ms)
  }
}
