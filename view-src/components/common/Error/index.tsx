import * as React from 'react'
import networkError from 'images/network-error.svg'
import serverError from 'images/server-error.svg'

import 'components/common/Error/Error.scss'

const Error = (props: any) => {
    const logo = props.type === 'network' ? networkError : serverError
    return (
        <div className="error">
            <img className="error-logo" src={logo} alt="logo" />
            {
                props.type === 'network'
                    ?
                    <p className="error-info">
                        It seems like something wrong with your network. Please <span onClick={props.retry}>retry</span>.
                    </p>
                    :
                    <p className="error-info">
                        It seems like something wrong with out server. Please wait for a while or <span onClick={props.retry}>retry</span>.
                    </p>
            }
        </div>
    )
}

export default Error