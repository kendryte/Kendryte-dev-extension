export interface FlashConfig {
    baseAddress: string
    totalSize: number
    endAddress: string
    downloadSections: {
        id: string
        filesize: number
        name: string
        address: string
        autoAddress: boolean
        filename: string
        addressEnd: string
        swapBytes: boolean
    }[]
    [key:string]: any
}

export interface BinaryFile {
    address: string
    bin: string
    sha256Prefix: boolean
}

export interface FlashList {
    version: string
    files: Array<BinaryFile>
}