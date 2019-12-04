/*
    Warning: This format function must be used as:

    format(`
        // content
    `)

    The first content line's indentation is necessary.
    The following line's indentation is based on the first line which have indentation.
*/
export const format = (str: string) => {
    let baseTab = 0
    let firstLine = true
    return str.replace(/\n(\s+)/g, (m, m1) => {
        if (firstLine) {
            baseTab = m1.length
            firstLine = !firstLine
            return m1.slice(baseTab)
        }
        return "\n" + m1.slice(baseTab)
    })
}