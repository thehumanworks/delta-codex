import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge'

const frame = document.querySelector('iframe')!
const params = new URLSearchParams(location.search)
const bridge = new AppBridge(
  null,
  { name: 'Delta browser fixture', version: '1' },
  { serverTools: {}, openLinks: {}, logging: {} },
  {
    hostContext: {
      theme: params.get('theme') === 'dark' ? 'dark' : 'light',
      displayMode: 'inline',
      availableDisplayModes: params.has('basic') ? ['inline'] : ['inline', 'fullscreen'],
    },
  },
)
bridge.oncalltool = async (params) =>
  (
    await fetch('/tool', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    })
  ).json()
bridge.onopenlink = async (params) => {
  ;(window as any).openedLink = params.url
  return {}
}
bridge.onrequestdisplaymode = async (params) => ({ mode: params.mode })
;(window as any).bridge = bridge
await bridge.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!))
frame.src = '/panel'
