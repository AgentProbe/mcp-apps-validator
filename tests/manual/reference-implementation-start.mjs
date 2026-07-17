import { McpAppsValidator } from '../../src/index.mjs'


const MCP_URL = process.env.MCP_SERVER_URL || 'https://your-mcp-server.example.com/mcp'


const runStart = async () => {
    console.log( `\n  Validating MCP Apps UI Extension: ${MCP_URL}\n` )

    try {
        const { status, findings, categories, entries } = await McpAppsValidator.start( { endpoint: MCP_URL, timeout: 15000 } )

        console.log( `  Status: ${status ? 'PASS' : 'FAIL'}` )
        console.log( `  Findings: ${findings.length === 0 ? 'none' : ''}` )

        findings
            .forEach( ( finding ) => {
                console.log( `    - [${finding['severity']}] ${finding['code']} ${finding['location']}: ${finding['message']}` )
            } )

        console.log( '\n  Categories:' )

        Object.entries( categories )
            .forEach( ( [ key, value ] ) => {
                console.log( `    ${key}: ${value}` )
            } )

        console.log( '\n  Server Info:' )
        console.log( `    Name: ${entries['serverName']}` )
        console.log( `    Version: ${entries['serverVersion']}` )
        console.log( `    Protocol: ${entries['protocolVersion']}` )
        console.log( `    Extension: ${entries['extensionVersion']}` )

        console.log( `\n  UI Resources: ${entries['uiResourceCount']}` )

        entries['uiResources']
            .forEach( ( resource ) => {
                console.log( `    - ${resource['uri']}: ${resource['name']} (CSP: ${resource['hasCsp']}, Permissions: ${resource['hasPermissions']})` )
            } )

        console.log( `\n  UI-Linked Tools: ${entries['uiLinkedToolCount']}` )

        entries['uiLinkedTools']
            .forEach( ( tool ) => {
                console.log( `    - ${tool['name']}: ${tool['resourceUri']} (${tool['visibility'].join( ', ' )})` )
            } )

        console.log( `    App-only tools: ${entries['appOnlyToolCount']}` )

        console.log( `\n  Tools: ${entries['tools'].length}` )
        console.log( `  Resources: ${entries['resources'].length}` )

        console.log( '\n  Latency:' )
        console.log( `    ListResources: ${entries['latency']['listResources']}ms` )
        console.log( `    ReadResource: ${entries['latency']['readResource']}ms` )

        console.log( `\n  Timestamp: ${entries['timestamp']}\n` )
    } catch( error ) {
        console.error( `\n  Error: ${error['message']}\n` )
    }
}


runStart()
