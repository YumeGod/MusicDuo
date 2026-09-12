import { VISION } from '../config/gestureConfig';
export class CameraManager {
  private stream?: MediaStream;
  async start(video: HTMLVideoElement, facingMode: 'user' | 'environment') {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        'Camera requires HTTPS or localhost. Practice mode is available.',
      );
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: VISION.cameraWidth },
        height: { ideal: VISION.cameraHeight },
      },
      audio: false,
    });
    video.srcObject = this.stream;
    await video.play();
  }
  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
  }
}
