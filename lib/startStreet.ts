import { prefetchSeed } from "./warmStreet";
import { worldLog } from "./worldLog";

type StreetCmd<T> = {
  uploadFile: (file: Blob, options?: { name?: string }) => Promise<T>;
  setImage: (params: { image: T }) => Promise<void>;
  setPrompt: (params: { prompt: string }) => Promise<void>;
  start: () => Promise<void>;
};

export async function startLingbotStreet<T>({
  seedSrc,
  fileName,
  prompt,
  cmd,
  armImageWait,
  cancelled,
}: {
  seedSrc: string;
  fileName: string;
  prompt: string;
  cmd: StreetCmd<T>;
  armImageWait: (resolve: () => void) => void;
  cancelled: () => boolean;
}) {
  const blob = await prefetchSeed(seedSrc);
  worldLog("seed blob", blob.size);
  if (cancelled()) return;

  const image = await cmd.uploadFile(blob, { name: fileName });
  worldLog("seed uploaded");
  if (cancelled()) return;

  const accepted = new Promise<void>((resolve) => armImageWait(resolve));
  await cmd.setImage({ image });
  worldLog("setImage sent, waiting accept");
  await Promise.race([
    accepted,
    new Promise<void>((resolve) => {
      window.setTimeout(() => {
        worldLog("image wait still open after 20s — starting anyway");
        resolve();
      }, 20_000);
    }),
  ]);
  if (cancelled()) return;

  worldLog("image accepted — setPrompt then start");
  await cmd.setPrompt({ prompt });
  if (cancelled()) return;
  await cmd.start();
  worldLog("lingbot start sent");
}
