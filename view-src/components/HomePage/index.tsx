import * as React from 'react'
import Add from 'images/add.svg'
import Example from 'images/project-blue.svg'
import Libraries from 'images/libraries-blue.svg'
import kendryteLogo from 'images/kendryte.svg'
import { webviewRequest } from 'utils/webviewRequest'

import 'components/HomePage/HomePage.scss'

const HomePage = (props: any) => {
    const linkTo = (path: string) => {
        props.setRouter(path)
    }
    const createNewProject = () => {
        webviewRequest({
            type: 'create'
        })
    }
    return (
        <div className="homepage">
            <div className="homepage-main">
                <img src={kendryteLogo} alt="logo" />
                <div className="homepage-main-version">
                    Current version
                    <span>0.3.1</span>
                </div>
                <div className="homepage-main-quickaccess">
                    <div className="accesses">
                        <button onClick={createNewProject}><img src={Add} alt="icon" />New Project</button>
                        <button onClick={() => linkTo('/libraries')}><img src={Libraries} alt="icon" />Libraries</button>
                        <button onClick={() => linkTo('/examples')}><img src={Example} alt="icon" />Examples</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HomePage