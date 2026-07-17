import { jest } from '@jest/globals'

import {
    MOCK_SERVER_INFO,
    MOCK_TOOLS,
    MOCK_RESOURCES,
    MOCK_CAPABILITIES_WITH_UI,
    MOCK_LATENCY,
    MOCK_VALID_HTML,
    MOCK_UI_RESOURCE_CONTENT,
    EXPECTED_CATEGORY_KEYS,
    EXPECTED_ENTRY_KEYS,
    EMPTY_CATEGORIES,
    TEST_ENDPOINT
} from '../../helpers/config.mjs'


// --- Mock Setup ---

const mockClient = {
    listTools: jest.fn().mockResolvedValue( { tools: MOCK_TOOLS } ),
    listResources: jest.fn().mockResolvedValue( { resources: MOCK_RESOURCES } ),
    readResource: jest.fn().mockResolvedValue( MOCK_UI_RESOURCE_CONTENT ),
    ping: jest.fn().mockResolvedValue( undefined ),
    close: jest.fn().mockResolvedValue( undefined ),
    getServerCapabilities: jest.fn().mockReturnValue( MOCK_CAPABILITIES_WITH_UI )
}

const mockConnector = {
    connect: jest.fn(),
    discover: jest.fn(),
    discoverUiResources: jest.fn(),
    readUiResource: jest.fn(),
    measureLatency: jest.fn(),
    disconnect: jest.fn()
}

jest.unstable_mockModule( '../../../src/task/McpAppsConnector.mjs', () => ( {
    McpAppsConnector: {
        connect: mockConnector['connect'],
        discover: mockConnector['discover'],
        discoverUiResources: mockConnector['discoverUiResources'],
        readUiResource: mockConnector['readUiResource'],
        measureLatency: mockConnector['measureLatency'],
        disconnect: mockConnector['disconnect']
    }
} ) )

jest.unstable_mockModule( '../../../src/task/UiResourceValidator.mjs', () => ( {
    UiResourceValidator: {
        validate: jest.fn()
    }
} ) )

const { McpAppsValidator } = await import( '../../../src/McpAppsValidator.mjs' )
const { UiResourceValidator } = await import( '../../../src/task/UiResourceValidator.mjs' )


const MOCK_UI_RESOURCES = [
    { uri: 'ui://weather-dashboard', name: 'Weather Dashboard', mimeType: 'text/html;profile=mcp-app' }
]

const MOCK_UI_LINKED_TOOLS = [
    { name: 'get_weather', resourceUri: 'ui://weather-dashboard', visibility: [ 'model', 'app' ] },
    { name: 'refresh_dashboard', resourceUri: 'ui://weather-dashboard', visibility: [ 'app' ] }
]

const MOCK_VALIDATED_RESOURCES = [
    {
        uri: 'ui://weather-dashboard',
        hasCsp: true,
        hasPermissions: true,
        hasTheming: false,
        displayModes: [],
        hasGracefulDegradation: false
    }
]


describe( 'McpAppsValidator.start', () => {

    beforeEach( () => {
        jest.clearAllMocks()
    } )


    describe( 'Parameter Validation', () => {

        test( 'throws when endpoint is missing', async () => {
            await expect( McpAppsValidator.start( {} ) ).rejects.toThrow( 'VAL-501' )
        } )


        test( 'throws when endpoint is not a string', async () => {
            await expect( McpAppsValidator.start( { endpoint: 42 } ) ).rejects.toThrow( 'VAL-502' )
        } )


        test( 'throws when endpoint is empty', async () => {
            await expect( McpAppsValidator.start( { endpoint: '  ' } ) ).rejects.toThrow( 'VAL-503' )
        } )


        test( 'throws when endpoint is invalid URL', async () => {
            await expect( McpAppsValidator.start( { endpoint: 'not-a-url' } ) ).rejects.toThrow( 'VAL-504' )
        } )


        test( 'throws when timeout is not a number', async () => {
            await expect( McpAppsValidator.start( { endpoint: TEST_ENDPOINT, timeout: 'fast' } ) ).rejects.toThrow( 'VAL-505' )
        } )


        test( 'throws when timeout is zero', async () => {
            await expect( McpAppsValidator.start( { endpoint: TEST_ENDPOINT, timeout: 0 } ) ).rejects.toThrow( 'VAL-506' )
        } )


        test( 'throws when timeout is negative', async () => {
            await expect( McpAppsValidator.start( { endpoint: TEST_ENDPOINT, timeout: -1 } ) ).rejects.toThrow( 'VAL-506' )
        } )
    } )


    describe( 'Unreachable Server', () => {

        test( 'returns empty categories when server is not reachable', async () => {
            mockConnector['connect'].mockResolvedValue( {
                status: false,
                findings: [ { code: 'CON-501', severity: 'error', location: 'endpoint', message: 'Server is not reachable' } ],
                client: null,
                serverInfo: null
            } )

            const { status, findings, categories, entries } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'CON-501' } ) )

            EXPECTED_CATEGORY_KEYS
                .forEach( ( key ) => {
                    expect( categories[key] ).toBe( false )
                } )

            expect( entries['endpoint'] ).toBe( TEST_ENDPOINT )
            expect( entries['serverName'] ).toBeNull()
            expect( entries['uiResources'] ).toEqual( [] )
        } )
    } )


    describe( 'Successful Pipeline', () => {

        beforeEach( () => {
            mockConnector['connect'].mockResolvedValue( {
                status: true,
                findings: [],
                client: mockClient,
                serverInfo: MOCK_SERVER_INFO
            } )

            mockConnector['discover'].mockResolvedValue( {
                status: true,
                findings: [],
                tools: MOCK_TOOLS,
                resources: MOCK_RESOURCES,
                capabilities: MOCK_CAPABILITIES_WITH_UI
            } )

            mockConnector['discoverUiResources'].mockReturnValue( {
                uiResources: MOCK_UI_RESOURCES,
                uiLinkedTools: MOCK_UI_LINKED_TOOLS
            } )

            mockConnector['readUiResource'].mockResolvedValue( {
                status: true,
                content: MOCK_VALID_HTML,
                mimeType: 'text/html;profile=mcp-app',
                meta: MOCK_UI_RESOURCE_CONTENT['contents'][0]['_meta']
            } )

            UiResourceValidator['validate'].mockResolvedValue( {
                findings: [],
                validatedResources: MOCK_VALIDATED_RESOURCES
            } )

            mockConnector['measureLatency'].mockResolvedValue( {
                latency: MOCK_LATENCY
            } )

            mockConnector['disconnect'].mockResolvedValue( {
                disconnected: true
            } )
        } )


        test( 'returns all 12 category keys', async () => {
            const { categories } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            const categoryKeys = Object.keys( categories )

            EXPECTED_CATEGORY_KEYS
                .forEach( ( key ) => {
                    expect( categoryKeys ).toContain( key )
                } )

            expect( categoryKeys.length ).toBe( 12 )
        } )


        test( 'returns all expected entry keys', async () => {
            const { entries } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            const entryKeys = Object.keys( entries )

            EXPECTED_ENTRY_KEYS
                .forEach( ( key ) => {
                    expect( entryKeys ).toContain( key )
                } )
        } )


        test( 'sets isReachable and supportsMcp to true', async () => {
            const { categories } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( categories['isReachable'] ).toBe( true )
            expect( categories['supportsMcp'] ).toBe( true )
        } )


        test( 'extracts server info into entries', async () => {
            const { entries } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( entries['serverName'] ).toBe( 'test-mcp-apps-server' )
            expect( entries['serverVersion'] ).toBe( '1.0.0' )
            expect( entries['protocolVersion'] ).toBe( '2025-03-26' )
        } )


        test( 'includes UI resource counts', async () => {
            const { entries } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( entries['uiResourceCount'] ).toBe( 1 )
            expect( entries['uiLinkedToolCount'] ).toBe( 2 )
            expect( entries['appOnlyToolCount'] ).toBe( 1 )
        } )


        test( 'includes latency in entries', async () => {
            const { entries } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( entries['latency']['listResources'] ).toBe( 80 )
            expect( entries['latency']['readResource'] ).toBe( 150 )
        } )


        test( 'includes timestamp in entries', async () => {
            const { entries } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( entries['timestamp'] ).toBeDefined()
            expect( typeof entries['timestamp'] ).toBe( 'string' )
        } )


        test( 'calls disconnect after pipeline', async () => {
            await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( mockConnector['disconnect'] ).toHaveBeenCalledTimes( 1 )
        } )


        test( 'returns status true when no findings', async () => {
            const { status, findings } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( status ).toBe( true )
            expect( findings ).toHaveLength( 0 )
        } )
    } )


    describe( 'Pipeline with validation findings', () => {

        beforeEach( () => {
            mockConnector['connect'].mockResolvedValue( {
                status: true,
                findings: [],
                client: mockClient,
                serverInfo: MOCK_SERVER_INFO
            } )

            mockConnector['discover'].mockResolvedValue( {
                status: true,
                findings: [],
                tools: MOCK_TOOLS,
                resources: MOCK_RESOURCES,
                capabilities: MOCK_CAPABILITIES_WITH_UI
            } )

            mockConnector['discoverUiResources'].mockReturnValue( {
                uiResources: MOCK_UI_RESOURCES,
                uiLinkedTools: MOCK_UI_LINKED_TOOLS
            } )

            mockConnector['measureLatency'].mockResolvedValue( {
                latency: MOCK_LATENCY
            } )

            mockConnector['disconnect'].mockResolvedValue( {
                disconnected: true
            } )
        } )


        test( 'returns status false when validation produces findings', async () => {
            UiResourceValidator['validate'].mockResolvedValue( {
                findings: [ { code: 'UIV-020', severity: 'warning', location: 'ui://weather-dashboard', message: 'No CSP configuration declared' } ],
                validatedResources: MOCK_VALIDATED_RESOURCES
            } )

            const { status, findings } = await McpAppsValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'UIV-020' } ) )
        } )
    } )
} )
