import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'


class McpAppsConnector {


    static async connect( { endpoint, timeout } ) {
        const findings = []

        const { reachable } = await McpAppsConnector.#checkReachable( { endpoint, timeout } )

        if( !reachable ) {
            findings.push( { code: 'CON-501', severity: 'error', location: 'endpoint', message: 'Server is not reachable' } )

            return { status: false, findings, client: null, serverInfo: null }
        }

        const { client, serverInfo, error } = await McpAppsConnector.#initializeClient( { endpoint, timeout } )

        if( error ) {
            findings.push( { code: 'CON-504', severity: 'error', location: 'mcp', message: `Initialize handshake failed — ${error}` } )

            return { status: false, findings, client: null, serverInfo: null }
        }

        return { status: true, findings, client, serverInfo }
    }


    static async discover( { client } ) {
        const findings = []

        const { tools } = await McpAppsConnector.#listTools( { client, findings } )
        const { resources } = await McpAppsConnector.#listResources( { client, findings } )

        const capabilities = McpAppsConnector.#getCapabilities( { client } )

        const status = true

        return { status, findings, tools, resources, capabilities }
    }


    static discoverUiResources( { resources, tools } ) {
        const uiResources = resources
            .filter( ( resource ) => {
                const uri = resource['uri'] || ''

                return uri.startsWith( 'ui://' )
            } )
            .map( ( resource ) => {
                const { uri, name, mimeType, description } = resource

                return { uri, name, mimeType, description }
            } )

        const uiLinkedTools = tools
            .filter( ( tool ) => {
                const meta = tool['_meta']

                if( !meta ) { return false }

                const ui = meta['ui']

                if( !ui ) { return false }

                return ui['resourceUri'] !== undefined
            } )
            .map( ( tool ) => {
                const { name } = tool
                const resourceUri = tool['_meta']['ui']['resourceUri']
                const visibility = tool['_meta']['ui']['visibility'] || [ 'model', 'app' ]

                return { name, resourceUri, visibility }
            } )

        return { uiResources, uiLinkedTools }
    }


    static async readUiResource( { client, uri } ) {
        try {
            const result = await client.readResource( { uri } )
            const contents = result['contents'] || []

            if( contents.length === 0 ) {
                return { status: false, content: null, mimeType: null, meta: null }
            }

            const first = contents[0]
            const text = first['text'] || null
            const mimeType = first['mimeType'] || null
            const meta = first['_meta'] || null

            return { status: true, content: text, mimeType, meta }
        } catch( _e ) {
            return { status: false, content: null, mimeType: null, meta: null }
        }
    }


    static async measureLatency( { client, uiResources } ) {
        const { durationMs: listResources } = await McpAppsConnector.#measureListResources( { client } )

        let readResource = null

        if( uiResources.length > 0 ) {
            const firstUri = uiResources[0]['uri']
            const { durationMs } = await McpAppsConnector.#measureReadResource( { client, uri: firstUri } )
            readResource = durationMs
        }

        const latency = { listResources, readResource }

        return { latency }
    }


    static async disconnect( { client } ) {
        if( !client ) {
            return { disconnected: true }
        }

        try {
            await client.close()
        } catch( _e ) {
            // Ignore disconnect errors
        }

        return { disconnected: true }
    }


    static #extractServerInfoFromClient( { client } ) {
        try {
            const version = client.getServerVersion()
            const protocolVersion = client?.['_transport']?.['_protocolVersion'] || null
            const instructions = client.getInstructions?.() || null

            const serverInfo = {
                serverInfo: {
                    name: version?.['name'] || null,
                    version: version?.['version'] || null,
                    description: version?.['description'] || null
                },
                protocolVersion,
                instructions
            }

            return serverInfo
        } catch( _e ) {
            return null
        }
    }


    static #getCapabilities( { client } ) {
        try {
            const capabilities = client.getServerCapabilities() || {}

            return capabilities
        } catch( _e ) {
            return {}
        }
    }


    static async #checkReachable( { endpoint, timeout } ) {
        const controller = new AbortController()
        const timer = setTimeout( () => { controller.abort() }, timeout )

        try {
            await fetch( endpoint, {
                method: 'HEAD',
                signal: controller['signal']
            } )

            clearTimeout( timer )

            return { reachable: true }
        } catch( _e ) {
            clearTimeout( timer )

            return { reachable: false }
        }
    }


    static async #initializeClient( { endpoint, timeout } ) {
        const clientInfo = { name: 'mcp-apps-validator', version: '0.2.0' }

        const { client: streamClient, serverInfo: streamInfo, error: streamError } = await McpAppsConnector.#tryStreamableHttp( { endpoint, timeout, clientInfo } )

        if( !streamError ) {
            return { client: streamClient, serverInfo: streamInfo, error: null }
        }

        const { client: sseClient, serverInfo: sseInfo, error: sseError } = await McpAppsConnector.#trySSE( { endpoint, timeout, clientInfo } )

        if( !sseError ) {
            return { client: sseClient, serverInfo: sseInfo, error: null }
        }

        return { client: null, serverInfo: null, error: sseError }
    }


    static async #tryStreamableHttp( { endpoint, timeout, clientInfo } ) {
        try {
            const transport = new StreamableHTTPClientTransport( new URL( endpoint ) )
            const client = new Client( clientInfo )

            await client.connect( transport )

            const serverInfo = McpAppsConnector.#extractServerInfoFromClient( { client } )

            return { client, serverInfo, error: null }
        } catch( e ) {
            const errorMsg = e['message'] || String( e )

            return { client: null, serverInfo: null, error: errorMsg }
        }
    }


    static async #trySSE( { endpoint, timeout, clientInfo } ) {
        try {
            const transport = new SSEClientTransport( new URL( endpoint ) )
            const client = new Client( clientInfo )

            await client.connect( transport )

            const serverInfo = McpAppsConnector.#extractServerInfoFromClient( { client } )

            return { client, serverInfo, error: null }
        } catch( e ) {
            const errorMsg = e['message'] || String( e )

            return { client: null, serverInfo: null, error: errorMsg }
        }
    }


    static async #listTools( { client, findings } ) {
        try {
            const result = await client.listTools()
            const tools = result['tools'] || []

            if( !Array.isArray( tools ) ) {
                findings.push( { code: 'CON-508', severity: 'warning', location: 'tools/list', message: 'Invalid response format' } )

                return { tools: [] }
            }

            return { tools }
        } catch( _e ) {
            findings.push( { code: 'CON-508', severity: 'warning', location: 'tools/list', message: 'Request failed' } )

            return { tools: [] }
        }
    }


    static async #listResources( { client, findings } ) {
        try {
            const result = await client.listResources()
            const resources = result['resources'] || []

            return { resources }
        } catch( _e ) {
            findings.push( { code: 'CON-510', severity: 'warning', location: 'resources/list', message: 'Request failed' } )

            return { resources: [] }
        }
    }


    static async #measureListResources( { client } ) {
        try {
            const start = performance.now()
            await client.listResources()
            const end = performance.now()
            const durationMs = Math.round( end - start )

            return { durationMs }
        } catch( _e ) {
            return { durationMs: null }
        }
    }


    static async #measureReadResource( { client, uri } ) {
        try {
            const start = performance.now()
            await client.readResource( { uri } )
            const end = performance.now()
            const durationMs = Math.round( end - start )

            return { durationMs }
        } catch( _e ) {
            return { durationMs: null }
        }
    }
}


export { McpAppsConnector }
