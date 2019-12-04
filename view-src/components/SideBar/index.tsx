import * as React from 'react'

import './SideBar.scss'
import kendryteLogo from 'images/kendryte.svg'
import librariesLogo from 'images/libraries.svg'
import projectLogo from 'images/project.svg'

const SideBar = (props: any) => {
    const sideItems = {
        "Libraries": librariesLogo,
        "Examples": projectLogo
    }
    const linkTo = (path: string) => {
        props.setRouter(path)
    }
    const renderSideItems = () => {
        return Object.keys(sideItems).map(item => {
            return (
                <div key={item} className={`side-bar-item ${props.router === `/${item.toLowerCase()}` ? 'current' : ''}`} onClick={() => linkTo(`/${item.toLowerCase()}`)} >
                    <img src={sideItems[item]} alt='logo' />
                    <span>{item}</span>
                </div>
            )
        })
    }
    return (
        <div className="side-bar">
            <div className="side-bar-item top" onClick={() => linkTo('/')}>
                <img src={kendryteLogo} className="kendryte" alt='logo' />
            </div>
            {
                renderSideItems()
            }
        </div>
    )
}

export default SideBar