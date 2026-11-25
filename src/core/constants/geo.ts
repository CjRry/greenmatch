/** Taiwan's 22 counties and cities with approximate centroids, used for distance matching. */
export const CITIES = [
  '台北市',
  '新北市',
  '基隆市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '台中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '台南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '台東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
] as const

export type City = (typeof CITIES)[number]

export type Region = '北部' | '中部' | '南部' | '東部' | '離島'

export const CITY_INFO: Record<City, { lat: number; lng: number; region: Region }> = {
  台北市: { lat: 25.0375, lng: 121.5637, region: '北部' },
  新北市: { lat: 25.012, lng: 121.4657, region: '北部' },
  基隆市: { lat: 25.1276, lng: 121.7392, region: '北部' },
  桃園市: { lat: 24.9937, lng: 121.301, region: '北部' },
  新竹市: { lat: 24.8138, lng: 120.9675, region: '北部' },
  新竹縣: { lat: 24.8387, lng: 121.0177, region: '北部' },
  苗栗縣: { lat: 24.5602, lng: 120.8214, region: '中部' },
  台中市: { lat: 24.1477, lng: 120.6736, region: '中部' },
  彰化縣: { lat: 24.0518, lng: 120.5161, region: '中部' },
  南投縣: { lat: 23.9609, lng: 120.9719, region: '中部' },
  雲林縣: { lat: 23.7092, lng: 120.4313, region: '中部' },
  嘉義市: { lat: 23.4801, lng: 120.4491, region: '南部' },
  嘉義縣: { lat: 23.4518, lng: 120.2555, region: '南部' },
  台南市: { lat: 22.9999, lng: 120.227, region: '南部' },
  高雄市: { lat: 22.6273, lng: 120.3014, region: '南部' },
  屏東縣: { lat: 22.5519, lng: 120.5487, region: '南部' },
  宜蘭縣: { lat: 24.7021, lng: 121.7378, region: '東部' },
  花蓮縣: { lat: 23.9871, lng: 121.6015, region: '東部' },
  台東縣: { lat: 22.7583, lng: 121.1444, region: '東部' },
  澎湖縣: { lat: 23.5711, lng: 119.5793, region: '離島' },
  金門縣: { lat: 24.4493, lng: 118.3767, region: '離島' },
  連江縣: { lat: 26.1602, lng: 119.9517, region: '離島' },
}

export const REGIONS: readonly Region[] = ['北部', '中部', '南部', '東部', '離島']

export function isCity(value: unknown): value is City {
  return typeof value === 'string' && (CITIES as readonly string[]).includes(value)
}

/** Great-circle distance between two city centroids, km (0 for the same city). */
export function cityDistanceKm(a: City, b: City): number {
  if (a === b) return 0
  const p = CITY_INFO[a]
  const q = CITY_INFO[b]
  const rad = Math.PI / 180
  const dLat = (q.lat - p.lat) * rad
  const dLng = (q.lng - p.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
