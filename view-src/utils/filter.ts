interface PackageData {
    [key: string]: any
}
export const filter = (keyword: string, data: PackageData): PackageData => {
    const resData: PackageData = {}
    // Search keyword in packagename and tags
    Object.keys(data).map(key => {
        const reg = new RegExp(keyword, 'ig')
        if (reg.test(key)) {
            resData[key] = data[key]
        } else {
            for (const tag of data[key].tags) {
                if (reg.test(tag)) {
                    resData[key] = data[key]
                    break
                }
            }
        }
        return key
    })
    return resData
}