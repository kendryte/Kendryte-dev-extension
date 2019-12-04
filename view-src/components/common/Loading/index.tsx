import * as React from 'react'

import 'components/common/Loading/Loading.scss'

const Loading = (props: any) => {
    const color = {
        borderTopColor: props.color || '#989898'
    }
    const size = {
        width: (props.size && props.size.width) || '4vw',
        height: (props.size && props.size.height) || '4vw'
    }
    return (
        <div className="lds-ring" style={size}>
            <div style={Object.assign(color, size)} />
            <div style={Object.assign(color, size)} />
            <div style={Object.assign(color, size)} />
            <div style={Object.assign(color, size)} />
        </div>
    )
}

export default Loading