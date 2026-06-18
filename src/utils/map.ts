export const mapCompare = <K, V>(
    a: ReadonlyMap<K, V>,
    b: ReadonlyMap<K, V>,
    compare: (valueA: V, valueB: V) => unknown,
): boolean => {
    if (a === b) return true
    if (a.size !== b.size) return false

    for (const [key, valueA] of a) {
        const valueB = b.get(key)
        if (valueB === undefined) return false

        if (!compare(valueA, valueB)) return false
    }

    return true
}

export const mapMerge = <K, V>(
    a: ReadonlyMap<K, V>,
    b: ReadonlyMap<K, V>,
    merge: (valueA: V | undefined, valueB: V | undefined) => V | undefined,
): ReadonlyMap<K, V> => {
    if (a === b) return a

    let result: Map<K, V> | undefined
    let sameAsB = true

    const getResult = () => (result ??= new Map(a))

    for (const [key, valueA] of a) {
        const valueB = b.get(key)

        const value = merge(valueA, valueB)
        if (value === undefined) {
            getResult().delete(key)
            if (valueB !== undefined) sameAsB = false
            continue
        }

        if (value !== valueA) getResult().set(key, value)
        if (value !== valueB) sameAsB = false
    }

    for (const [key, valueB] of b) {
        if (a.has(key)) continue

        const value = merge(undefined, valueB)
        if (value === undefined) {
            sameAsB = false
            continue
        }

        getResult().set(key, value)
        if (value !== valueB) sameAsB = false
    }

    if (!result) return a
    if (sameAsB && result.size === b.size) return b

    return result
}
