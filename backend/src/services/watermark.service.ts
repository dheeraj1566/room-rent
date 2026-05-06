import sharp from "sharp";

export interface WatermarkOptions {
  opacity?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  text?: string;
}

export class WatermarkService {
  private static readonly DEFAULT_OPTIONS: Required<WatermarkOptions> = {
    opacity: 0.8,
    position: 'bottom-right',
    text: 'Roombaazi',
  };

  /**
   * Renders a full-width bottom banner with logo on the left and brand text on
   * the right — similar to the Decathlon-style watermark.
   */
  static async addLogoWatermark(
    imageBuffer: Buffer,
    logoPath: string,
    options: WatermarkOptions = {}
  ): Promise<Buffer> {
    try {
      const opts = { ...this.DEFAULT_OPTIONS, ...options };

      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Unable to read image dimensions');
      }

      const imgWidth = metadata.width;
      const imgHeight = metadata.height;

      // Banner is ~9% of image height, clamped between 36px and 100px
      const bannerHeight = Math.max(36, Math.min(100, Math.floor(imgHeight * 0.09)));
      const padding = Math.max(6, Math.floor(bannerHeight * 0.14));
      const logoHeight = bannerHeight - padding * 2;

      // Resize logo to fit inside the banner strip
      const logoBuffer = await sharp(logoPath)
        .resize(null, logoHeight, { fit: 'inside' })
        .png()
        .toBuffer();

      const logoMeta = await sharp(logoBuffer).metadata();
      const logoWidth = logoMeta.width || logoHeight;

      // Font size proportional to banner height
      const fontSize = Math.floor(bannerHeight * 0.52);
      const brandText = opts.text;
      const safeBrandText = brandText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

      // Text receives its own dark pill background; the rest stays transparent.
      const textPaddingX = Math.max(8, Math.floor(fontSize * 0.45));
      const textPillHeight = Math.max(fontSize + 8, Math.floor(bannerHeight * 0.72));
      const textWidth = Math.ceil(brandText.length * fontSize * 0.62) + textPaddingX * 2;
      const textY = Math.floor((textPillHeight + fontSize * 0.36) / 2);

      const textSvgBuffer = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg"
              width="${textWidth}"
              height="${textPillHeight}">
          <rect
            x="0"
            y="0"
            width="${textWidth}"
            height="${textPillHeight}"
            rx="${Math.floor(textPillHeight / 2)}"
            ry="${Math.floor(textPillHeight / 2)}"
            fill="rgba(0,0,0,0.72)"
          />
          <text
            x="${textPaddingX}"
            y="${textY}"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize}"
            font-weight="bold"
            fill="white"
            letter-spacing="1"
          >${safeBrandText}</text>
        </svg>`
      );

      // Build a transparent overlay layer so only text has background treatment.
      const banner = await sharp({
        create: {
          width: imgWidth,
          height: bannerHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([
          // Logo at left with padding
          {
            input: logoBuffer,
            left: padding,
            top: padding,
            blend: 'over',
          },
          // Brand text immediately to the right of the logo
          {
            input: textSvgBuffer,
            left: padding + logoWidth + padding,
            top: Math.floor((bannerHeight - textPillHeight) / 2),
            blend: 'over',
          },
        ])
        .png()
        .toBuffer();

      // Overlay the finished banner at the bottom of the main image
      return image
        .composite([
          {
            input: banner,
            top: imgHeight - bannerHeight,
            left: 0,
            blend: 'over',
          },
        ])
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (error) {
      console.error('Error adding logo watermark:', error);
      return imageBuffer;
    }
  }
}
