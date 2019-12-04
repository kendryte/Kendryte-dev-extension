export interface PlatformPackage {
    readonly source: string
}

export interface PackageData {
    readonly projectName: string
    readonly win32: PlatformPackage
    readonly darwin?: PlatformPackage
    readonly linux?: PlatformPackage
    readonly version: string
    readonly source: string
}

export interface PackagesVersion {
    [key: string]: string
}