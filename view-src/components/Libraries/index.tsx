import * as React from 'react'
import ItemCard from 'components/ItemCard'
import Loading from 'components/common/Loading'
import Error from 'components/common/Error'
import { filter } from 'utils/filter'
import { webviewRequest } from 'utils/webviewRequest'
import Axios from 'axios'

import 'components/Libraries/Libraries.scss'

const Libraries = (props: any) => {
    const [keyword, setKeyword] = React.useState('')
    const [libraryList, setLibraryList] = React.useState({})
    const [requestStatus, setRequestStatus] = React.useState('pending')
    const [localDependencies, setLocalDependencies] = React.useState([] as Array<string>)

    const getData = () => {
        setRequestStatus('pending')
        Axios({
            method: "get",
            url: `https://mirrors-kendryte.s3.cn-northwest-1.amazonaws.com.cn/${props.type}/list.json`,
            responseType: "json"
        }).then(res => {
            if (res.status === 200) {
                const type = props.type === 'example' ? 'examples' : 'packages'
                setLibraryList(res.data[type])
                setRequestStatus('success')
            } else {
                setRequestStatus('server error')
            }
        }).catch(error => {
            setRequestStatus('network error')
        })
    }

    // First request
    React.useEffect(() => {
        getData()
        setKeyword('')
        // Check local dependencies
        if (props.type === 'package') {
            webviewRequest({
                type: 'check'
            })
                .then(data => {
                    setLocalDependencies(data.dependencies)
                })
        }
        // eslint-disable-next-line
    }, [props.type])

    const libraries = filter(keyword, libraryList)

    const renderLibraries = () => {
        switch (requestStatus) {
            case 'pending':
                return (
                    <div className="loading">
                        <Loading />
                        <span>Loading</span>
                    </div>
                )
            case 'network error':
                return (
                    <div>
                        <Error retry={getData} type="network" />
                    </div>
                )
            case 'server error':
                return (
                    <Error retry={getData} type="server" />
                )
            default:
                return Object.keys(libraries).map(library => {
                    return (
                        <ItemCard
                            key={library}
                            library={libraries[library]}
                            setKeyword={setKeyword}
                            type={props.type}
                            installed={localDependencies.indexOf(library) >= 0}
                        />
                    )
                })
        }
    }

    return (
        <div className="libraries">
            <div className="libraries-input">
                <input
                    value={keyword}
                    onChange={event => setKeyword(event.target.value)}
                    placeholder="Search..."
                />
            </div>
            <div className="libraries-list">
                {
                    renderLibraries()
                }
            </div>
        </div>
    )
}

export default Libraries