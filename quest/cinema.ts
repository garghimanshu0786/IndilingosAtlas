

import { worldLog } from "@/lib/worldLog";
import { runDriveTick } from "./driveLoop";
import { clearXrPadAxes, pollXrInputSources } from "./xrInput";
import { headLookFromPose, resetHeadLookCalibration } from "./headLook";

let xrSession: XRSession | null = null;

export function currentXrSession() {
  return xrSession;
}

export function findStreetVideo(root: ParentNode): HTMLVideoElement | null {
  return root.querySelector("video");
}

export async function canEnterVr() {
  try {
    return Boolean(await navigator.xr?.isSessionSupported("immersive-vr"));
  } catch {
    return false;
  }
}

export async function enterCinema(
  video: HTMLVideoElement,
  onHeadLook?: (look: { h: "idle" | "left" | "right"; v: "idle" | "up" | "down" }) => void,
  _domRoot?: HTMLElement | null,
  onSessionEnd?: () => void,
): Promise<() => void> {
  if (!window.isSecureContext) {
    throw new Error("Quest needs HTTPS for Enter VR. Restart with next dev --experimental-https.");
  }
  if (!(await canEnterVr())) {
    throw new Error("This browser will not start immersive VR.");
  }
  await primeVideoForVr(video);
  resetHeadLookCalibration();
  const session = await navigator.xr!.requestSession("immersive-vr", {
    optionalFeatures: ["local-floor", "layers"],
  });
  xrSession = session;
  session.addEventListener("end", () => {
    if (xrSession === session) {
      xrSession = null;
      clearXrPadAxes();
      resetHeadLookCalibration();
    }
    onSessionEnd?.();
  });
  session.addEventListener("inputsourceschange", () => {
    worldLog("quest XR inputs", session.inputSources.length);
  });

  const wrap = (stop: () => void) => () => {
    stop();
    if (xrSession === session) xrSession = null;
  };

  worldLog("quest VR FOV layer (viewer-locked)");
  return wrap(await startViewerStreetLayer(session, video, onHeadLook));
}

async function startViewerStreetLayer(
  session: XRSession,
  video: HTMLVideoElement,
  onHeadLook?: (look: { h: "idle" | "left" | "right"; v: "idle" | "up" | "down" }) => void,
) {
  const Ctor = (window as unknown as { XRWebGLBinding?: XRWebGLBindingCtor }).XRWebGLBinding;
  if (!Ctor) throw new Error("Quest Browser is missing XRWebGLBinding layers.");

  const canvas = document.createElement("canvas");
  const gl =
    (canvas.getContext("webgl2", { xrCompatible: true }) as WebGLRenderingContext | null) ||
    (canvas.getContext("webgl", { xrCompatible: true }) as WebGLRenderingContext | null);
  if (!gl) throw new Error("WebGL is missing in this headset browser.");
  await (gl as WebGLRenderingContext & { makeXRCompatible?: () => Promise<void> }).makeXRCompatible?.();

  const binding = new Ctor(session, gl);
  const viewer = await session.requestReferenceSpace("viewer");
  const floor = await session.requestReferenceSpace("local-floor").catch(() => session.requestReferenceSpace("local"));

  const vw = video.videoWidth || 1664;
  const vh = video.videoHeight || 960;
  const aspect = vw / vh;
  const layer = createStreetLayer(binding, viewer, vw, vh, aspect);
  session.updateRenderState({ layers: [layer] });
  worldLog("quest VR layer", layer.kind, `${vw}×${vh}`);

  const scratch = document.createElement("canvas");
  const ctx = scratch.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D is missing for VR video bridge.");

  let alive = true;
  let texFails = 0;
  let drew = false;

  const onFrame: XRFrameRequestCallback = (_t, frame) => {
    if (!alive) return;
    session.requestAnimationFrame(onFrame);
    pollXrInputSources(session);
    runDriveTick();
    onHeadLook?.(headLookFromPose(frame.getViewerPose(floor)));

    if (video.readyState < 2 || video.videoWidth < 1) return;

    if (scratch.width !== video.videoWidth || scratch.height !== video.videoHeight) {
      scratch.width = video.videoWidth;
      scratch.height = video.videoHeight;
    }

    try {
      ctx.drawImage(video, 0, 0, scratch.width, scratch.height);
      const sub = binding.getSubImage(layer.raw, frame);
      gl.bindTexture(gl.TEXTURE_2D, sub.colorTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
      gl.bindTexture(gl.TEXTURE_2D, null);
      if (!drew) {
        drew = true;
        worldLog("quest VR street frame ok");
      }
    } catch (err) {
      texFails += 1;
      if (texFails === 1) worldLog("quest VR street tex failed", err);
    }
  };

  session.requestAnimationFrame(onFrame);
  return () => {
    alive = false;
    void session.end();
  };
}

function createStreetLayer(
  binding: XRWebGLBindingLike,
  viewer: XRReferenceSpace,
  vw: number,
  vh: number,
  aspect: number,
): { kind: string; raw: XRCompositionLayerLike } {
  const init = {
    space: viewer,
    viewPixelWidth: vw,
    viewPixelHeight: vh,
    layout: "mono" as const,
  };

  if (typeof binding.createCylinderLayer === "function") {
    try {
      const cyl = binding.createCylinderLayer({
        ...init,
        radius: 2.2,
        centralAngle: (110 * Math.PI) / 180,
        aspectRatio: aspect,
      });
      cyl.transform = new XRRigidTransform();
      return { kind: "cylinder", raw: cyl };
    } catch (err) {
      worldLog("quest VR cylinder failed, using quad", err);
    }
  }
  const halfW = 1.28;
  const halfH = halfW / aspect;
  const quad = binding.createQuadLayer(init);
  quad.width = halfW;
  quad.height = halfH;
  quad.transform = new XRRigidTransform({ x: 0, y: 0, z: -1.15 });
  return { kind: "quad", raw: quad };
}

type XRWebGLBindingCtor = new (session: XRSession, context: WebGLRenderingContext) => XRWebGLBindingLike;

type XRCompositionLayerLike = XRLayer & {
  transform: XRRigidTransform;
  width?: number;
  height?: number;
  radius?: number;
  centralAngle?: number;
  aspectRatio?: number;
};

type XRWebGLBindingLike = {
  createQuadLayer: (init: {
    space: XRReferenceSpace;
    viewPixelWidth: number;
    viewPixelHeight: number;
    layout?: string;
  }) => XRCompositionLayerLike;
  createCylinderLayer?: (init: {
    space: XRReferenceSpace;
    viewPixelWidth: number;
    viewPixelHeight: number;
    layout?: string;
    radius?: number;
    centralAngle?: number;
    aspectRatio?: number;
  }) => XRCompositionLayerLike;
  getSubImage: (layer: XRCompositionLayerLike, frame: XRFrame) => { colorTexture: WebGLTexture };
};

async function primeVideoForVr(video: HTMLVideoElement) {
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  if (video.paused) {
    try {
      await video.play();
    } catch (err) {
      worldLog("quest VR video play", err);
    }
  }
  if (video.videoWidth > 0 && video.readyState >= 2) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      if (video.videoWidth > 0 && video.readyState >= 2) {
        video.removeEventListener("loadeddata", done);
        video.removeEventListener("resize", done);
        resolve();
      }
    };
    video.addEventListener("loadeddata", done);
    video.addEventListener("resize", done);
    window.setTimeout(resolve, 4000);
    done();
  });
}
