import { resolve } from 'node:path'
import { type Config, loadConfig } from 'irsforge-shared-config'

let _config: Config | null = null

export function getConfig(): Config {
  if (!_config) {
    const configPath =
      process.env['IRSFORGE_CONFIG_PATH'] ?? resolve(process.cwd(), '../irsforge.yaml')
    _config = loadConfig(configPath)
  }
  return _config
}
