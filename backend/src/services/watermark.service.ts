import sharp from "sharp";

export interface WatermarkOptions {
  opacity?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
}

export class WatermarkService {
  private static readonly DEFAULT_OPTIONS: Required<WatermarkOptions> = {
    opacity: 0.3,
    position: 'bottom-right',
  };

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

      const logoSize = Math.floor(metadata.width * 0.1);

      const logoBuffer = await sharp(logoPath)
        .resize(logoSize, logoSize, { fit: 'inside' })
        .png()
        .toBuffer();

      const logoMetadata = await sharp(logoBuffer).metadata();

      const position = this.getWatermarkPosition(
        metadata.width,
        metadata.height,
        logoMetadata.width || logoSize,
        logoMetadata.height || logoSize,
        opts.position
      );

      return image
        .composite([{
          input: logoBuffer,
          left: position.left,
          top: position.top,
          blend: 'over',
        }])
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (error) {
      console.error('Error adding logo watermark:', error);
      return imageBuffer;
    }
  }

  private static getWatermarkPosition(
    imageWidth: number,
    imageHeight: number,
    watermarkWidth: number,
    watermarkHeight: number,
    position: string
  ): { left: number; top: number } {
    const padding = 20;

    switch (position) {
      case 'top-left':
        return { left: padding, top: padding };
      case 'top-right':
        return { left: imageWidth - watermarkWidth - padding, top: padding };
      case 'bottom-left':
        return { left: padding, top: imageHeight - watermarkHeight - padding };
      case 'center':
        return { left: (imageWidth - watermarkWidth) / 2, top: (imageHeight - watermarkHeight) / 2 };
      case 'bottom-right':
      default:
        return { left: imageWidth - watermarkWidth - padding, top: imageHeight - watermarkHeight - padding };
    }
  }
}
