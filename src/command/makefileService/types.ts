export interface ProjectInfo {
    path: string
    isRoot: boolean
    config: ProjectConfig
}

export interface ProjectConfig {
    name: string
    version: string
    type: string
    dependencies?: {
        [key:string]: string
    },
    include?: Array<string>
    includeFolders: Array<string>
    source: Array<string>
    header: Array<string>
    homepage?: string
    definitions?: {
        [key: string]: any
    }
    extraList?: string
    properties?: {
        [key: string]: any
    }
    c_flags?: Array<string>
    cpp_flags?: Array<string>
    c_cpp_flags?: Array<string>
    link_flags?: Array<string>
    ld_file?: string
    linkArgumentPrefix?: Array<string>
    linkArgumentSuffix?: Array<string>
    systemLibrary?: Array<string>
    debug: boolean
    localDependency?: Array<string>
    [key: string]: any
}

export interface FileList {
    [key: string]: string
}