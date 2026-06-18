export const intersection = <K>(
    a: ReadonlySet<K> = new Set(),
    b: ReadonlySet<K> = new Set(),
): ReadonlySet<K> => {
    if (a === b) return a

    const result = new Set<K>()
    for (const value of a) {
        if (b.has(value)) result.add(value)
    }

    if (result.size === a.size) return a
    if (result.size === b.size) return b

    return result
}

export const union = <K>(
    a: ReadonlySet<K> = new Set(),
    b: ReadonlySet<K> = new Set(),
): ReadonlySet<K> => {
    if (a === b) return a

    let result: Set<K> | undefined
    const getResult = () => (result ??= new Set(a))

    for (const value of b) {
        if (a.has(value)) continue

        getResult().add(value)
    }

    if (!result) return a
    if (result.size === b.size) return b

    return result
}

export const compare = <K>(a: ReadonlySet<K>, b: ReadonlySet<K>): boolean => {
    if (a === b) return true
    if (a.size !== b.size) return false

    for (const value of a) {
        if (!b.has(value)) return false
    }

    return true
}
