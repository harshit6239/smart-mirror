import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const HOTSPOT_SSID = 'SmartMirror-Setup'
const HOTSPOT_PASSWORD = 'mirror1234'
const AP_IP = '10.42.0.1'

export type WifiNetwork = { ssid: string; signal: number }

export class WifiService {
  private readonly isLinux = process.platform === 'linux'

  async isConnected(): Promise<boolean> {
    if (!this.isLinux) return true
    try {
      const { stdout } = await execAsync('nmcli -t -f STATE general')
      return stdout.trim() === 'connected'
    } catch {
      return false
    }
  }

  async startHotspot(ssid = HOTSPOT_SSID, password = HOTSPOT_PASSWORD): Promise<void> {
    if (!this.isLinux) {
      console.log(`[wifi] stub: startHotspot("${ssid}")`)
      return
    }
    await execAsync(`nmcli device wifi hotspot ssid "${ssid}" password "${password}" ifname wlan0`)
  }

  async stopHotspot(): Promise<void> {
    if (!this.isLinux) {
      console.log('[wifi] stub: stopHotspot')
      return
    }
    try {
      await execAsync('nmcli connection down Hotspot')
    } catch {
      // hotspot may not be running — ignore
    }
  }

  async scanNetworks(): Promise<WifiNetwork[]> {
    if (!this.isLinux) {
      return [
        { ssid: 'Home Network', signal: 80 },
        { ssid: 'Office WiFi', signal: 65 },
        { ssid: 'Neighbour 2.4G', signal: 40 }
      ]
    }
    try {
      const { stdout } = await execAsync('nmcli -t -f SSID,SIGNAL dev wifi list | sort -t: -k2 -rn')
      const seen = new Set<string>()
      return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const colonIdx = line.lastIndexOf(':')
          const ssid = line.slice(0, colonIdx).trim()
          const signal = parseInt(line.slice(colonIdx + 1), 10) || 0
          return { ssid, signal }
        })
        .filter(({ ssid }) => {
          if (!ssid || seen.has(ssid)) return false
          seen.add(ssid)
          return true
        })
    } catch {
      return []
    }
  }

  async connectToNetwork(ssid: string, password: string): Promise<boolean> {
    if (!this.isLinux) {
      console.log(`[wifi] stub: connectToNetwork("${ssid}") → true`)
      return true
    }
    try {
      await execAsync(`nmcli device wifi connect "${ssid}" password "${password}"`)
      return true
    } catch {
      return false
    }
  }

  getApIp(): string {
    return AP_IP
  }

  getHotspotSsid(): string {
    return HOTSPOT_SSID
  }

  getHotspotPassword(): string {
    return HOTSPOT_PASSWORD
  }
}
