import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import UnoCss from 'unocss/vite'
import { presetIcons, presetUno } from 'unocss'
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'
import { globSync } from 'glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getIcons() {
  const icons: Record<string, string[]> = {}
  const files = globSync('src/assets/icons/**/*.svg', {
    cwd: __dirname,
    nodir: true
  })

  files.forEach((filePath) => {
    const fileName = path.basename(filePath)
    const fileNameWithoutExt = path.parse(fileName).name
    const folderName = path.basename(path.dirname(filePath))
    if (!icons[folderName]) {
      icons[folderName] = []
    }
    icons[folderName].push(`i-${folderName}:${fileNameWithoutExt}`)
  })

  return icons
}

const icons = getIcons()
const collections = Object.fromEntries(
  Object.keys(icons).map((item) => [
    item,
    FileSystemIconLoader(path.join(__dirname, 'src/assets/icons', item))
  ])
)

// https://vite.dev/config/
export default defineConfig({
  base:"./",
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
    UnoCss({
      presets: [
        presetUno(),
        presetIcons({
          warn: true,
          prefix: ['i-'],
          extraProperties: {
            display: 'inline-block'
          },
          collections
        })
      ],
      theme: {
        colors: {
          'bt-theme': '#16a34a'
        }
      },
      rules: [
        [/^fz-(\d+)$/, (match) => ({ 'font-size': `${match[1]}px` })],
        [/^fw-(\w+)$/, (match) => ({ 'font-weight': `${match[1]}` })],
        [/^c-([0-9a-fA-F]{6})$/, (match) => ({ color: `#${match[1]}` })],
        [/^w-(\d+)$/, (match) => ({ width: `${match[1]}px` })],
        [/^h-(\d+)$/, (match) => ({ height: `${match[1]}px` })],
        [/^mt-(\d+)$/, (match) => ({ 'margin-top': `${match[1]}px` })],
        [/^mr-(\d+)$/, (match) => ({ 'margin-right': `${match[1]}px` })],
        [/^mb-(\d+)$/, (match) => ({ 'margin-bottom': `${match[1]}px` })],
        [/^ml-(\d+)$/, (match) => ({ 'margin-left': `${match[1]}px` })],
        [/^pt-(\d+)$/, (match) => ({ 'padding-top': `${match[1]}px` })],
        [/^pr-(\d+)$/, (match) => ({ 'padding-right': `${match[1]}px` })],
        [/^pb-(\d+)$/, (match) => ({ 'padding-bottom': `${match[1]}px` })],
        [/^pl-(\d+)$/, (match) => ({ 'padding-left': `${match[1]}px` })]
      ]
    }),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar'
          ]
        }
      ],
      dts: "src/auto-imports.d.ts"
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
  },
  server: {
    port: 5173
  }
})
