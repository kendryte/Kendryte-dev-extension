import * as React from 'react'
import tagLogo from 'images/tag.svg'
import coreLogo from 'images/core.svg'
import Hook from 'images/hook.svg'
import { webviewRequest } from 'utils/webviewRequest'
import Loading from 'components/common/Loading'

import 'components/ItemCard/ItemCard.scss'

const ItemCard = (props: any) => {
    const [installStatus, setInstallStatus] = React.useState(0)
    const renderTags = () => {
        return props.library.tags.map((tag: string) => {
            return <span key={tag} className="tag" onClick={() => {props.setKeyword(tag)}}>{tag}</span>
        })
    }
    const postInstallMsg = () => {
        if (props.type === 'package') setInstallStatus(1)
        webviewRequest({
            type: props.type,
            name: props.library.name
        })
            .then(data => {
                console.log(data)
                if (props.type === 'package') setInstallStatus(2)
            })
            .catch(error => {
                console.log('error!')
                if (props.type === 'package') setInstallStatus(0)
            })
    }
    const renderButton = () => {
        if (props.installed) {
            return <img src={Hook} style={{height: '3vh'}} alt="logo" />
        }
        switch(installStatus) {
            case 0:
                return <button onClick={postInstallMsg}>Install</button>
            case 1:
                return <Loading color="#249edc" size={{width: '3vh', height: '3vh'}} />
            case 2:
                return <img src={Hook} style={{height: '3vh'}} alt="logo" />
            default:
                return <button onClick={postInstallMsg}>Install</button>
        }
    }
    return (
        <div className="itemcard">
            <div className="itemcard-header">
                <div className="itemcard-header-left">
                    <span className="itemcard-header-left-package">{props.library.name}</span>
                    by
                    <span className="itemcard-header-left-author">{props.library.author}</span>
                </div>
                <div className="itemcard-header-right">
                    <img src={coreLogo} alt="logo" />
                    <span>{props.library.board}</span>
                </div>
            </div>
            <div className="itemcard-body">
                <span className="itemcard-body-desc">{props.library.description}</span>
                <div className="itemcard-body-tags">
                    <img src={tagLogo} alt="logo" />
                    {
                        renderTags()
                    }
                </div>
                <div className="itemcard-body-install">
                    <span>Version: {Object.keys(props.library.versions)[0]}</span>
                    {
                        renderButton()
                    }
                </div>
            </div>
        </div>
    )
}

export default ItemCard