import { ProjectConfig } from '@command/makefileService/types'
import { FlashConfig } from '@common/index'
import { configReader } from '@utils/index'

export const flashConfigParser = async (path: string): Promise<FlashConfig | undefined> => {
    const reader = configReader<FlashConfig>(`${path}/config/flash-manager.json`)
    if (!reader) {
        return
    }
    
    return reader
}