import { McpAppsConnector } from './McpAppsConnector.mjs'


const KNOWN_PERMISSIONS = [ 'camera', 'microphone', 'geolocation', 'clipboardWrite' ]

const KNOWN_DISPLAY_MODES = [ 'inline', 'fullscreen', 'pip' ]

const SENSITIVE_PERMISSIONS = [ 'camera', 'microphone' ]


class UiResourceValidator {


    static async validate( { client, uiResources, tools, timeout } ) {
        const findings = []
        const validatedResources = []

        const uiLinkedTools = tools
            .filter( ( tool ) => {
                const meta = tool['_meta']

                if( !meta ) { return false }

                const ui = meta['ui']

                return ui && ui['resourceUri'] !== undefined
            } )
            .map( ( tool ) => {
                const { name } = tool
                const resourceUri = tool['_meta']['ui']['resourceUri']
                const visibility = tool['_meta']['ui']['visibility'] || [ 'model', 'app' ]

                return { name, resourceUri, visibility }
            } )

        await UiResourceValidator.#processResources( { client, uiResources, findings, validatedResources } )

        UiResourceValidator.#validateToolLinkage( { uiLinkedTools, uiResources, findings } )
        UiResourceValidator.#validateToolUiMeta( { tools, findings } )

        return { findings, validatedResources }
    }


    static async #processResources( { client, uiResources, findings, validatedResources } ) {
        const resourcePromises = uiResources
            .map( async ( resource ) => {
                const uri = resource['uri']

                const { status, content, mimeType, meta } = await McpAppsConnector.readUiResource( { client, uri } )

                if( !status ) {
                    findings.push( { code: 'UIR-001', severity: 'warning', location: `resources/read ${uri}`, message: 'Resource read failed' } )

                    return
                }

                if( mimeType !== 'text/html;profile=mcp-app' && mimeType !== 'text/html' ) {
                    findings.push( { code: 'UIR-002', severity: 'warning', location: `resources/read ${uri}`, message: `Expected text/html content, got "${mimeType}"` } )

                    return
                }

                const uiMeta = meta?.['ui'] || null

                const validated = {
                    uri,
                    name: resource['name'],
                    mimeType,
                    hasCsp: false,
                    hasPermissions: false,
                    displayModes: [],
                    hasTheming: false,
                    hasGracefulDegradation: false
                }

                UiResourceValidator.#validateHtmlContent( { uri, content, findings } )
                UiResourceValidator.#validateCsp( { uri, uiMeta, findings, validated } )
                UiResourceValidator.#validatePermissions( { uri, uiMeta, findings, validated } )
                UiResourceValidator.#validateDisplayMode( { uri, uiMeta, findings, validated } )
                UiResourceValidator.#validateThemeSupport( { uri, content, findings, validated } )
                UiResourceValidator.#validateGracefulDegradation( { uri, content, findings, validated } )

                validatedResources.push( validated )
            } )

        await Promise.all( resourcePromises )
    }


    static #validateHtmlContent( { uri, content, findings } ) {
        if( content === null || content === undefined ) {
            findings.push( { code: 'UIV-010', severity: 'warning', location: uri, message: 'HTML content is missing' } )

            return
        }

        if( typeof content !== 'string' ) {
            findings.push( { code: 'UIV-011', severity: 'warning', location: uri, message: 'HTML content is not a string' } )

            return
        }

        if( content.trim() === '' ) {
            findings.push( { code: 'UIV-012', severity: 'warning', location: uri, message: 'HTML content is empty' } )

            return
        }

        const lowerContent = content.toLowerCase()
        const hasDoctype = lowerContent.includes( '<!doctype html>' )
        const hasHtmlTag = lowerContent.includes( '<html' )
        const hasBodyTag = lowerContent.includes( '<body' )

        if( !hasDoctype && !hasHtmlTag && !hasBodyTag ) {
            findings.push( { code: 'UIV-013', severity: 'warning', location: uri, message: 'HTML content appears invalid (missing doctype, html, or body tag)' } )
        }
    }


    static #validateCsp( { uri, uiMeta, findings, validated } ) {
        if( !uiMeta || !uiMeta['csp'] ) {
            findings.push( { code: 'UIV-020', severity: 'warning', location: uri, message: 'No CSP configuration declared' } )

            return
        }

        validated['hasCsp'] = true

        const csp = uiMeta['csp']
        const connectDomains = csp['connectDomains'] || []
        const resourceDomains = csp['resourceDomains'] || []
        const frameDomains = csp['frameDomains'] || []

        const allDomains = [ ...connectDomains, ...resourceDomains, ...frameDomains ]

        allDomains
            .forEach( ( domain ) => {
                if( !domain.startsWith( 'https://' ) && !domain.startsWith( 'wss://' ) && domain !== 'self' ) {
                    findings.push( { code: 'UIV-021', severity: 'warning', location: uri, message: `CSP domain "${domain}" should use https:// or wss://` } )
                }
            } )

        const hasWildcard = allDomains
            .some( ( domain ) => domain === '*' || domain === 'https://*' )

        if( hasWildcard ) {
            findings.push( { code: 'UIV-022', severity: 'warning', location: uri, message: 'CSP contains wildcard domain — allows unrestricted access' } )
        }
    }


    static #validatePermissions( { uri, uiMeta, findings, validated } ) {
        if( !uiMeta || !uiMeta['permissions'] ) {
            return
        }

        validated['hasPermissions'] = true

        const permissions = uiMeta['permissions']
        const declaredKeys = Object.keys( permissions )

        const unknownPermissions = declaredKeys
            .filter( ( key ) => !KNOWN_PERMISSIONS.includes( key ) )

        if( unknownPermissions.length > 0 ) {
            findings.push( { code: 'UIV-030', severity: 'warning', location: uri, message: `Unknown permissions declared: ${unknownPermissions.join( ', ' )}` } )
        }

        const sensitiveUsed = declaredKeys
            .filter( ( key ) => SENSITIVE_PERMISSIONS.includes( key ) )

        if( sensitiveUsed.length > 0 ) {
            findings.push( { code: 'UIV-031', severity: 'warning', location: uri, message: `Sensitive permissions requested: ${sensitiveUsed.join( ', ' )}` } )
        }
    }


    static #validateDisplayMode( { uri, uiMeta, findings, validated } ) {
        if( !uiMeta || !uiMeta['displayModes'] ) {
            findings.push( { code: 'UIV-041', severity: 'info', location: uri, message: 'No display modes declared' } )

            return
        }

        const displayModes = uiMeta['displayModes']

        if( !Array.isArray( displayModes ) || displayModes.length === 0 ) {
            findings.push( { code: 'UIV-041', severity: 'info', location: uri, message: 'No display modes declared' } )

            return
        }

        validated['displayModes'] = displayModes

        const unknownModes = displayModes
            .filter( ( mode ) => !KNOWN_DISPLAY_MODES.includes( mode ) )

        if( unknownModes.length > 0 ) {
            findings.push( { code: 'UIV-040', severity: 'info', location: uri, message: `Unknown display modes: ${unknownModes.join( ', ' )}` } )
        }
    }


    static #validateThemeSupport( { uri, content, findings, validated } ) {
        if( !content || typeof content !== 'string' ) {
            return
        }

        const lowerContent = content.toLowerCase()
        const hasColorScheme = lowerContent.includes( 'color-scheme' )
        const hasCssVariables = content.includes( 'var(--' )
        const hasLightDark = lowerContent.includes( 'light-dark(' )
        const hasDataTheme = lowerContent.includes( 'data-theme' )

        const acknowledged = hasColorScheme || hasCssVariables || hasLightDark || hasDataTheme

        if( acknowledged ) {
            validated['hasTheming'] = true
        } else {
            findings.push( { code: 'UIV-050', severity: 'info', location: uri, message: 'No theming acknowledgment found (no color-scheme, CSS variables, or data-theme)' } )
        }
    }


    static #validateGracefulDegradation( { uri, content, findings, validated } ) {
        if( !content || typeof content !== 'string' ) {
            return
        }

        const lowerContent = content.toLowerCase()
        const hasNoscript = lowerContent.includes( '<noscript' )
        const hasTextContent = lowerContent.includes( 'noscript' ) || lowerContent.includes( 'fallback' )

        if( hasNoscript || hasTextContent ) {
            validated['hasGracefulDegradation'] = true
        } else {
            findings.push( { code: 'UIV-070', severity: 'info', location: uri, message: 'No graceful degradation found (no <noscript> or text fallback)' } )
        }
    }


    static #validateToolLinkage( { uiLinkedTools, uiResources, findings } ) {
        if( uiLinkedTools.length === 0 ) {
            findings.push( { code: 'UIV-062', severity: 'info', location: 'tools', message: 'No tools linked to UI resources' } )

            return
        }

        const uiUris = uiResources
            .map( ( r ) => r['uri'] )

        uiLinkedTools
            .forEach( ( tool ) => {
                const { name, resourceUri, visibility } = tool

                if( !uiUris.includes( resourceUri ) ) {
                    findings.push( { code: 'UIV-060', severity: 'warning', location: `tool ${name}`, message: `References non-existent UI resource "${resourceUri}"` } )
                }

                if( visibility && Array.isArray( visibility ) ) {
                    const invalidVisibility = visibility
                        .filter( ( v ) => v !== 'model' && v !== 'app' )

                    if( invalidVisibility.length > 0 ) {
                        findings.push( { code: 'UIV-061', severity: 'warning', location: `tool ${name}`, message: `Invalid visibility values: ${invalidVisibility.join( ', ' )}` } )
                    }
                }
            } )
    }


    static #validateToolUiMeta( { tools, findings } ) {
        tools
            .forEach( ( tool ) => {
                const { name } = tool
                const meta = tool['_meta']

                if( !meta ) { return }

                const ui = meta['ui']

                if( !ui ) { return }

                if( ui['resourceUri'] === undefined || ui['resourceUri'] === null ) {
                    findings.push( { code: 'UIV-063', severity: 'info', location: name, message: 'Has UI metadata but no resourceUri' } )
                }
            } )
    }
}


export { UiResourceValidator }
