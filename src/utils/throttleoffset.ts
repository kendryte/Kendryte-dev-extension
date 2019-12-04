import { throttle } from 'lodash'
export const throttleOffset = <T extends (...args: any) => any>(func: T, gapTime: number, offset: number): (...args: any) => void => {
    let enableThrottle = false
    let timer: NodeJS.Timeout
    let handler = func
    const throttleHandler = throttle(func, gapTime)
    return (...args) => {
        if (!timer) {
            timer = global.setTimeout(() => {
                enableThrottle = true
            }, offset)
        }
    
        if (enableThrottle) {
            throttleHandler(...args)
        } else {
            handler(...args)
        }
    }
}