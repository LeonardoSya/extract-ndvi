import { fromFile } from "geotiff";
import pkg from "pg";
const { Client } = pkg;

const beijingBounds = {
  minLon: 115.7,
  maxLon: 117.4,
  minLat: 39.4,
  maxLat: 41.6,
};

// 创建 PostgreSQL 客户端
const client = new Client({
  user: "zhangyiyang",
  host: "localhost",
  database: "firelens_nextjs_pg",
  password: "040724",
  port: 5432,
});

async function processNDVI() {
  try {
    await client.connect();

    // 读取 GeoTIFF 文件
    const tiff = await fromFile("./data/ndvi2407.tif");
    const image = await tiff.getImage();
    const rasters = await image.readRasters();
    const [ndviData] = rasters;

    // 获取图像的元数据
    const fileDirectory = image.fileDirectory;
    const geoKeys = image.geoKeys;
    const width = image.getWidth();
    const height = image.getHeight();

    let originX, originY, scaleX, scaleY;

    if (geoKeys && geoKeys.GTModelTypeGeoKey === 2) {
      // 地理坐标系
      originX = fileDirectory.ModelTiepoint[3];
      originY = fileDirectory.ModelTiepoint[4];
      scaleX = fileDirectory.ModelPixelScale[0];
      scaleY = -fileDirectory.ModelPixelScale[1];
    } else {
      console.error("不支持的坐标系类型或缺少地理信息");
      return;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 遍历图像的每个像素
        const lon = originX + x * scaleX;
        const lat = originY + y * scaleY;

        // 检查是否在北京范围内
        if (
          lon >= beijingBounds.minLon &&
          lon <= beijingBounds.maxLon &&
          lat >= beijingBounds.minLat &&
          lat <= beijingBounds.maxLat
        ) {
          const ndvi = ndviData[y * width + x];
          if (ndvi !== 32767) {
            // 检查是否为 NODATA 值
            await client.query(
              "INSERT INTO beijing_ndvi (longitude, latitude, ndvi) VALUES ($1, $2, $3)",
              [lon, lat, ndvi / 10000] //  NDVI 值需要除以 10000 来获得正确的范围
            );
          }
        }
      }
    }

    console.log("ndvi提取完成并入库");
  } catch (err) {
    console.error("发生错误:", err.message);
    console.error("错误堆栈:", err.stack);
  } finally {
    await client.end();
  }
}

processNDVI();
