import Phaser from 'phaser';

export const GAME_DPR =
  typeof window !== 'undefined' ? Math.min(Math.max(window.devicePixelRatio || 1, 1), 2.5) : 1;

export const TEXT_RESOLUTION = Math.min(Math.max(2, Math.ceil(GAME_DPR)), 3);

let crispTextPatched = false;

export function installCrispPhaserText(): void {
  if (crispTextPatched) return;
  crispTextPatched = true;

  const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (
      x: number,
      y: number,
      text: string | string[],
      style?: Phaser.Types.GameObjects.Text.TextStyle
    ) => Phaser.GameObjects.Text;
  };

  const origText = proto.text;
  proto.text = function (
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const mergedStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      resolution: TEXT_RESOLUTION,
      ...(style ?? {})
    };
    return origText.call(this, x, y, text, mergedStyle);
  };
}
