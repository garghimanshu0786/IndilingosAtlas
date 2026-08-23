

interface XRRigidTransform {
  readonly orientation: DOMPointReadOnly;
  readonly position: DOMPointReadOnly;
}

interface XRViewerPose {
  readonly transform: XRRigidTransform;
  readonly views: XRView[];
}

interface XRView {
  readonly transform: XRRigidTransform;
}

interface XRViewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface XRWebGLLayer {
  readonly framebuffer: WebGLFramebuffer | null;
  getViewport(view: XRView): XRViewport | null;
}

declare const XRWebGLLayer: {
  new (session: XRSession, context: WebGLRenderingContext): XRWebGLLayer;
};

declare const XRRigidTransform: {
  new (position?: { x: number; y: number; z: number; w?: number }): XRRigidTransform;
};

interface XRLayer {}

interface XRRenderState {
  readonly baseLayer: XRWebGLLayer | null;
  readonly layers?: XRLayer[];
}

interface XRFrame {
  getViewerPose(space: XRReferenceSpace): XRViewerPose | undefined;
}

interface XRReferenceSpace {}

type XRFrameRequestCallback = (time: number, frame: XRFrame) => void;

interface XRInputSource {
  readonly handedness: "none" | "left" | "right";
  readonly gamepad: Gamepad | null;
}

interface XRSession extends EventTarget {
  readonly renderState: XRRenderState;
  readonly inputSources: readonly XRInputSource[];
  requestReferenceSpace(type: string): Promise<XRReferenceSpace>;
  requestAnimationFrame(callback: XRFrameRequestCallback): number;
  updateRenderState(state: { baseLayer?: XRWebGLLayer; layers?: XRLayer[] }): void;
  end(): Promise<void>;
}

interface XRSessionInit {
  optionalFeatures?: string[];
  domOverlay?: { root: HTMLElement };
}

interface XRSystem {
  isSessionSupported(mode: string): Promise<boolean>;
  requestSession(mode: string, options?: XRSessionInit): Promise<XRSession>;
}

interface Navigator {
  xr?: XRSystem;
}
