import { jest, describe, test, expect } from '@jest/globals'

import {
    MOCK_TOOLS,
    MOCK_TOOLS_NO_UI,
    MOCK_RESOURCES,
    MOCK_VALID_HTML,
    MOCK_INVALID_HTML,
    MOCK_EMPTY_HTML,
    MOCK_HTML_WITH_THEME,
    MOCK_HTML_WITH_FALLBACK,
    MOCK_UI_RESOURCE_CONTENT,
    MOCK_UI_RESOURCE_NO_CSP,
    MOCK_UI_RESOURCE_INVALID_HTML,
    MOCK_UI_RESOURCE_EMPTY,
    MOCK_UI_RESOURCE_WITH_WILDCARD_CSP,
    MOCK_UI_RESOURCE_WITH_UNKNOWN_PERMISSION
} from '../../helpers/config.mjs'


jest.unstable_mockModule( '../../../src/task/McpAppsConnector.mjs', () => ( {
    McpAppsConnector: {
        readUiResource: jest.fn()
    }
} ) )

const { McpAppsConnector } = await import( '../../../src/task/McpAppsConnector.mjs' )
const { UiResourceValidator } = await import( '../../../src/task/UiResourceValidator.mjs' )


const UI_RESOURCES = [ { uri: 'ui://weather-dashboard', name: 'Weather Dashboard', mimeType: 'text/html;profile=mcp-app' } ]


describe( 'UiResourceValidator', () => {

    describe( 'validate — HTML Content', () => {

        test( 'passes with valid HTML', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { findings, validatedResources } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            const htmlErrors = findings
                .filter( ( f ) => [ 'UIV-010', 'UIV-011', 'UIV-012', 'UIV-013' ].includes( f['code'] ) )

            expect( htmlErrors ).toHaveLength( 0 )
            expect( validatedResources ).toHaveLength( 1 )
        } )


        test( 'reports UIR-001 when resource read fails', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: false,
                content: null,
                mimeType: null,
                meta: null
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIR-001', severity: 'warning' } ) )
        } )


        test( 'reports UIR-002 when mimeType is wrong', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: '{"json": true}',
                mimeType: 'application/json',
                meta: null
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIR-002', severity: 'warning' } ) )
        } )


        test( 'reports UIV-012 for empty HTML', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_EMPTY_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: null
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-012', severity: 'warning' } ) )
        } )


        test( 'reports UIV-013 for invalid HTML structure', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_INVALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: null
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-013', severity: 'warning' } ) )
        } )
    } )


    describe( 'validate — CSP', () => {

        test( 'reports UIV-020 when no CSP is declared', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: null
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-020', severity: 'warning' } ) )
        } )


        test( 'reports UIV-022 when CSP has wildcard', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_WITH_WILDCARD_CSP['contents'][0]['_meta']
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-022', severity: 'warning' } ) )
        } )


        test( 'sets hasCsp true when CSP is declared', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { validatedResources } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( validatedResources[0]['hasCsp'] ).toBe( true )
        } )
    } )


    describe( 'validate — Permissions', () => {

        test( 'reports UIV-030 for unknown permissions', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_WITH_UNKNOWN_PERMISSION['contents'][0]['_meta']
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-030', message: expect.stringContaining( 'bluetooth' ) } ) )
        } )


        test( 'reports UIV-031 for sensitive permissions', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: {
                    ui: {
                        csp: { connectDomains: [] },
                        permissions: { camera: {}, microphone: {} }
                    }
                }
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-031', message: expect.stringContaining( 'camera' ) } ) )
        } )


        test( 'sets hasPermissions true when permissions declared', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { validatedResources } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( validatedResources[0]['hasPermissions'] ).toBe( true )
        } )
    } )


    describe( 'validate — Theming', () => {

        test( 'reports UIV-050 when no theming acknowledgment', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-050', severity: 'info' } ) )
        } )


        test( 'detects theming via color-scheme', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_HTML_WITH_THEME,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { validatedResources } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( validatedResources[0]['hasTheming'] ).toBe( true )
        } )
    } )


    describe( 'validate — Graceful Degradation', () => {

        test( 'reports UIV-070 when no fallback', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-070', severity: 'info' } ) )
        } )


        test( 'detects graceful degradation via noscript', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_HTML_WITH_FALLBACK,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { validatedResources } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( validatedResources[0]['hasGracefulDegradation'] ).toBe( true )
        } )
    } )


    describe( 'validate — Tool Linkage', () => {

        test( 'reports UIV-060 when tool references non-existent resource', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const brokenTools = [
                {
                    name: 'broken_tool',
                    _meta: {
                        ui: {
                            resourceUri: 'ui://nonexistent',
                            visibility: [ 'model', 'app' ]
                        }
                    }
                }
            ]

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: brokenTools,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-060', severity: 'warning' } ) )
        } )


        test( 'reports UIV-061 for invalid visibility values', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const toolsWithBadVisibility = [
                {
                    name: 'bad_vis_tool',
                    _meta: {
                        ui: {
                            resourceUri: 'ui://weather-dashboard',
                            visibility: [ 'model', 'app', 'admin' ]
                        }
                    }
                }
            ]

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: toolsWithBadVisibility,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-061', severity: 'warning' } ) )
        } )


        test( 'no tool linkage errors when tools match resources', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            const linkageErrors = findings
                .filter( ( f ) => [ 'UIV-060', 'UIV-061' ].includes( f['code'] ) )

            expect( linkageErrors ).toHaveLength( 0 )
        } )


        test( 'reports UIV-062 when no tools are linked to UI resources', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS_NO_UI,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-062', severity: 'info' } ) )
        } )


        test( 'reports UIV-063 when tool has UI metadata but no resourceUri', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            const toolsWithUiNoResourceUri = [
                {
                    name: 'incomplete_tool',
                    _meta: {
                        ui: {
                            visibility: [ 'app' ]
                        }
                    }
                }
            ]

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: toolsWithUiNoResourceUri,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-063', location: expect.stringContaining( 'incomplete_tool' ) } ) )
        } )
    } )


    describe( 'validate — Display Modes', () => {

        test( 'reports UIV-041 when no displayModes declared in uiMeta', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: {
                    ui: {
                        csp: { connectDomains: [] }
                    }
                }
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-041', severity: 'info' } ) )
        } )


        test( 'reports UIV-041 when displayModes is empty array', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: {
                    ui: {
                        csp: { connectDomains: [] },
                        displayModes: []
                    }
                }
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-041', severity: 'info' } ) )
        } )


        test( 'does not report UIV-041 when displayModes has entries', async () => {
            McpAppsConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: {
                    ui: {
                        csp: { connectDomains: [] },
                        displayModes: [ 'inline' ]
                    }
                }
            } )

            const { findings } = await UiResourceValidator.validate( {
                client: {},
                uiResources: UI_RESOURCES,
                tools: MOCK_TOOLS,
                timeout: 5000
            } )

            const uiv041 = findings
                .filter( ( f ) => f['code'] === 'UIV-041' )

            expect( uiv041 ).toHaveLength( 0 )
        } )
    } )
} )
