import { window } from 'vscode'
import * as fg from 'fast-glob'
import { ProjectConfig } from '@command/makefileService/types'
import { configReader } from '@utils/index'
import { join } from 'path'

export const projectConfigParser = async (path: string): Promise<ProjectConfig | undefined> => {
    const reader = configReader<ProjectConfig>(`${path}/kendryte-package.json`)
    if (!reader) {
        window.showErrorMessage(`Cannot find kendryte-package.json on ${path}. Please check it and reinstall dependencies.`)
        return
    }
    const originalDependency: ProjectConfig["dependencies"] = reader.dependencies || {}
    const dependencyList = Object.keys(originalDependency) // 原始包名 list ，格式与目录中不同，需要处理
    const dependency: ProjectConfig["dependencies"] = {}
    const includes = reader.include || []
    const isLib = /\/kendryte_libraries\//.test(path)
    const includeList: Array<string> = []
    await Promise.all(dependencyList.map(async dependencyItem => {
        // 包名格式化
        const dependencyValue = originalDependency[dependencyItem]
        const name = dependencyItem.replace(/\//g, '_')
        dependency[name] = dependencyValue

        // 以下为 include 检测
        dependencyItem = (!isLib ? 'kendryte_libraries/' : '../') + name // kendryte_libraries/kendryte_xxx-xxx || ../kendryte_xxx-xxx
        const dependencyPath = `${path}/${dependencyItem}`

        // Include 包含两部分：1. 依赖中 include 目录 2. 手动配置的 include 3. 依赖中手动配置的 include 4. 自身 include 目录
        // 依赖 include 检测
        // try {
        //     const list = await fg('**/include', {
        //         cwd: dependencyPath,
        //         onlyDirectories: true
        //     })
        //     list.map((item, index) => {
        //         list[index] = `${dependencyItem}/${item}`
        //     })
        //     includeList.push.apply(includeList, list)
        // } catch (err) {
        //     window.showErrorMessage(err)
        //     throw (err)
        // }
        // 添加依赖中手动定义的 include
        const depReader = configReader<ProjectConfig>(join(dependencyPath, 'kendryte-package.json'))
        if (depReader && depReader.include) {
            depReader.include.map(include => includeList.push(join(dependencyItem, include).replace(/\\/g, '/')))
        }
    }))

    // 手动配置 include 检测（不包含包中配置的 include）
    includes.map(include => includeList.push(include))

    // 覆写 source 参数 /^a.*\.c$/
    const originalSource = reader.source
    const sourceArr: Array<string> = []
    await Promise.all(originalSource.map(async item => {
        const list = await fg(item, {
            cwd: path,
            onlyFiles: true
        })
        sourceArr.push.apply(sourceArr, list)
    }))

    reader.name = reader.name.replace(/\//, '_')
    reader.source = sourceArr
    reader.dependencies = dependency // 覆写格式化后过的依赖列表
    reader.includeFolders = includeList
    return reader
}