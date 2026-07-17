class CapabilityClassifier {


    static classify( { capabilities, uiResources, uiLinkedTools, validatedResources } ) {
        const findings = []

        const { detected: supportsMcpApps } = CapabilityClassifier.#detectExtension( { capabilities } )

        if( !supportsMcpApps ) {
            findings.push( { code: 'UIV-080', severity: 'info', location: 'capabilities', message: 'MCP Apps extension not declared (missing io.modelcontextprotocol/ui)' } )
        }

        const { extensionVersion } = CapabilityClassifier.#extractExtensionVersion( { capabilities } )

        if( supportsMcpApps && !extensionVersion ) {
            findings.push( { code: 'UIV-081', severity: 'info', location: 'capabilities', message: 'Extension version not specified' } )
        }

        const { hasItems: hasUiResources } = CapabilityClassifier.#hasNonEmpty( { items: uiResources } )
        const { hasItems: hasUiToolLinkage } = CapabilityClassifier.#hasNonEmpty( { items: uiLinkedTools } )

        const { hasValid: hasValidUiHtml } = CapabilityClassifier.#hasValidHtml( { validatedResources } )
        const { hasValid: hasValidCsp } = CapabilityClassifier.#allHaveCsp( { validatedResources } )
        const { hasValid: supportsTheming } = CapabilityClassifier.#anyHasTheming( { validatedResources } )
        const { hasValid: supportsDisplayModes } = CapabilityClassifier.#anyHasDisplayModes( { validatedResources } )
        const { hasValid: hasToolVisibility } = CapabilityClassifier.#anyHasVisibility( { uiLinkedTools } )
        const { hasValid: hasValidPermissions } = CapabilityClassifier.#allHaveValidPermissions( { validatedResources, findings: [] } )
        const { hasValid: hasGracefulDegradation } = CapabilityClassifier.#anyHasGracefulDegradation( { validatedResources } )

        const categories = {
            supportsMcpApps,
            hasUiResources,
            hasUiToolLinkage,
            hasValidUiHtml,
            hasValidCsp,
            supportsTheming,
            supportsDisplayModes,
            hasToolVisibility,
            hasValidPermissions,
            hasGracefulDegradation
        }

        return { categories, findings }
    }


    static #detectExtension( { capabilities } ) {
        if( !capabilities || typeof capabilities !== 'object' ) {
            return { detected: false }
        }

        const uiExt = capabilities['io.modelcontextprotocol/ui']
            || ( capabilities['experimental'] && capabilities['experimental']['io.modelcontextprotocol/ui'] )
        const detected = uiExt !== undefined && uiExt !== null

        return { detected }
    }


    static #extractExtensionVersion( { capabilities } ) {
        if( !capabilities || typeof capabilities !== 'object' ) {
            return { extensionVersion: null }
        }

        const uiExt = capabilities['io.modelcontextprotocol/ui']
            || ( capabilities['experimental'] && capabilities['experimental']['io.modelcontextprotocol/ui'] )

        if( !uiExt || typeof uiExt !== 'object' ) {
            return { extensionVersion: null }
        }

        const extensionVersion = uiExt['version'] || null

        return { extensionVersion }
    }


    static #hasNonEmpty( { items } ) {
        const hasItems = Array.isArray( items ) && items.length > 0

        return { hasItems }
    }


    static #hasValidHtml( { validatedResources } ) {
        const hasValid = validatedResources.length > 0

        return { hasValid }
    }


    static #allHaveCsp( { validatedResources } ) {
        if( validatedResources.length === 0 ) {
            return { hasValid: false }
        }

        const hasValid = validatedResources
            .every( ( r ) => r['hasCsp'] === true )

        return { hasValid }
    }


    static #anyHasTheming( { validatedResources } ) {
        const hasValid = validatedResources
            .some( ( r ) => r['hasTheming'] === true )

        return { hasValid }
    }


    static #anyHasDisplayModes( { validatedResources } ) {
        const hasValid = validatedResources
            .some( ( r ) => r['displayModes'] && r['displayModes'].length > 0 )

        return { hasValid }
    }


    static #anyHasVisibility( { uiLinkedTools } ) {
        const hasValid = uiLinkedTools
            .some( ( t ) => {
                const vis = t['visibility']

                return Array.isArray( vis ) && vis.length > 0 && ( vis.includes( 'app' ) || vis.length !== 2 || !vis.includes( 'model' ) )
            } )

        return { hasValid }
    }


    static #allHaveValidPermissions( { validatedResources, findings } ) {
        if( validatedResources.length === 0 ) {
            return { hasValid: false }
        }

        const hasUnknown = findings
            .some( ( finding ) => finding['code'] === 'UIV-030' )

        const hasValid = !hasUnknown

        return { hasValid }
    }


    static #anyHasGracefulDegradation( { validatedResources } ) {
        const hasValid = validatedResources
            .some( ( r ) => r['hasGracefulDegradation'] === true )

        return { hasValid }
    }
}


export { CapabilityClassifier }
