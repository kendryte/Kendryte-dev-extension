import * as vscode from 'vscode'
import { format, writeFilePromisify } from '@utils/index'
import { JTagConfigExtra, FtdiConfigExtra } from '@command/configGenerate/types'


export const createOpenocdConfigFile = async (port: number): Promise<void> => {
    const data = await createConfigContent(port)
    await writeFilePromisify(`${vscode.workspace.rootPath}/.vscode/openocd.cfg`, data)
    // this.logger.info('config file write to: ' + `${vscode.workspace.rootPath}/.vscode/openocd.cfg`)
}

const createConfigContent = async (port: number): Promise<string> => {
    const type = vscode.workspace.getConfiguration('openocd').get('useKey')
    // this.logger.info('port=' + port)

    let serialNumber: number = vscode.workspace.getConfiguration('JTag').get('ID') || 0
    switch (type) {
        case 'JTag':
            return await createDefaultJTagConfig(port, {
                speed: vscode.workspace.getConfiguration('JTag').get('speed') || 3000,
                serialNumber,
            })
        case 'FTDI':
            return await createDefaultFtdiConfig(port, {
                speed: vscode.workspace.getConfiguration('FTDI').get('speed') || 2500,
                layoutInit: vscode.workspace.getConfiguration('FTDI').get('layout') || '00e8 00eb',
                vidPid: vscode.workspace.getConfiguration('FTDI').get('vid_pid') || '0403 6014',
                tdoSampleFallingEdge: vscode.workspace.getConfiguration('FTDI').get('tdo-fe') || true
            })
        default:
            return await createDefaultJTagConfig(port, {
                speed: vscode.workspace.getConfiguration('JTag').get('speed') || 3000,
                serialNumber,
            })
    }
}

// Openocd config generator
const createDefaultJTagConfig = (port: number, options: JTagConfigExtra): string => {
    return format(`
        # debug adapter
        interface jlink
        ${options.serialNumber > 0 ? '' : '# '}jlink serial ${options.serialNumber}
        transport select jtag
        adapter_khz ${options.speed}
        gdb_port ${port}
        tcl_port ${port + 1}
        telnet_port ${port + 2}
        set _CHIPNAME riscv
        jtag newtap $_CHIPNAME cpu -irlen 5 -expected-id 0x04e4796b
        set _TARGETNAME $_CHIPNAME.cpu
        target create $_TARGETNAME riscv -chain-position $_TARGETNAME
        init
        halt
    `)
}
const createDefaultFtdiConfig = (port: number, config: FtdiConfigExtra): string => {
    const [vid1, vid2] = config.vidPid.split(/\s/)
    const [lay1, lay2] = config.layoutInit.split(/\s/)
    return format(`
        interface ftdi
        # for canaan's ftdi
        ftdi_vid_pid 0x${vid1} 0x${vid2}
        ftdi_layout_init 0x${lay1} 0x${lay2}

        transport select jtag
        ${config.tdoSampleFallingEdge ? '' : '# '}ftdi_tdo_sample_edge falling
        adapter_khz 3000
        gdb_port ${port}
        tcl_port ${port + 1}
        telnet_port ${port + 2}
        set _CHIPNAME riscv
        jtag newtap $_CHIPNAME cpu -irlen 5 -expected-id 0x04e4796b
        set _TARGETNAME $_CHIPNAME.cpu
        target create $_TARGETNAME riscv -chain-position $_TARGETNAME

        $_TARGETNAME configure -event reset-start {
            adapter_khz 100
        }

        $_TARGETNAME configure -event reset-init {
            adapter_khz ${config.speed}
        }
        init
    `)
}