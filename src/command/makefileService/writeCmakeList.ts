import * as vscode from 'vscode'
import { writeFileSync, readFileSync } from 'fs'
import { fileListReader } from '@command/makefileService/cmakeListFileReader'
import { ProjectInfo, ProjectConfig, FileList } from '@command/makefileService/types'
import { format } from '@utils/index'
import { join } from 'path'

export const createCmakeListFile = (project: ProjectInfo, dependencies?: Array<ProjectInfo>): void => {
    if (!process.env.packagePath) {
        vscode.window.showErrorMessage('No local dependencies found. Please try to execute reinsall packages command.')
        return
    }
    const fileReader = fileListReader(join(process.env.packagePath, 'cmake-list-files'))
    const data = cmakeListTemplete(project.path, project.config, project.isRoot, fileReader, dependencies)
    writeFileSync(`${project.path}/CMakeLists.txt`, data)
}

const cmakeListTemplete = (projectPath: string, projectConfig: ProjectConfig, isRoot: boolean, fileReader:FileList, dependencies?: Array<ProjectInfo>): string => {
    return (`
# DO NOT MODIFY THIS FILE, IT WILL BE OVERRIDE!!!
# You can set the "automake" options as false on kendryte-package.json to disable auto generate CMakeLists.txt file

# [section] Head
${fileReader.reset}
cmake_minimum_required(VERSION 3.0.0)
set(PROJECT_NAME "${projectConfig.name}")
# [/section] Head

# [section] Init
${isRoot ? rootInitSection(fileReader) : '# not need in sub project'}
${debugModeProperty(projectConfig.debug)}
set(CMAKE_GENERATOR "Unix Makefiles" CACHE INTERNAL "this const is defined by toolchain")
set(CMAKE_GENERATOR_INSTANCE "" CACHE INTERNAL "this const is defined by toolchain")
# [/section] Init

# [section] Project
${fileReader.fix9985}
message("======== PROJECT:\${PROJECT_NAME} ========")
project(\${PROJECT_NAME})

## [section] Header
${includeDirs(projectConfig.header, projectConfig.includeFolders)}
## [/section] Header
## [section] Source
${sourceFiles(projectConfig.source)}
## [/section] Source
# [/section] Project

# [section] Custom
${projectConfig.extraList ? readFileSync(`${projectPath}/${projectConfig.extraList}`, 'utf-8') : ''}
# [/section] Custom

# [section] Target
${createTarget(projectConfig.type, projectConfig.source, projectConfig.name)}
${debugModeValue(projectConfig.debug)}
${setProperties(projectConfig.properties, projectConfig.definitions, dependencies)}
# [/section] Target

# [section] Dependency
${addSubProjects(isRoot, projectConfig.dependencies, projectConfig.localDependency, projectConfig.name)}
# [/section] Dependency

# [section] C/C++ compiler flags
${flags(projectConfig.c_flags, projectConfig.cpp_flags, projectConfig.c_cpp_flags)}
${linkSubProjects(isRoot, dependencies)}
# [/section] C/C++ compiler flags

# [section] Finish
${finishSection(fileReader)}
${flashable(isRoot, projectConfig.type, fileReader)}
# [/section] Finish

# [section] Dump Setting
${fileReader.dumpConfig}
${projectConfig.debug ? 'message("\n  ${PROJECT_NAME} :: SOURCE_FILES=${SOURCE_FILES}")' : ''}
# [/section] Dump Setting
    `)
}

const rootInitSection = (fileReader: FileList) => {
    return [
        fileReader.macros,
        fileReader.coreFlags,
        fileReader.ideSettings,
        fileReader.toolchain,
    ].join('\n')
}

const debugModeProperty = (debug: boolean): string => {
    if (!debug) {
        return '# debug mode disabled'
    }
    return format(`
        # debug mode enabled
        set(-DCMAKE_VERBOSE_MAKEFILE TRUE)
        set_property(GLOBAL PROPERTY JOB_POOLS single_debug=1)
    `)
}

const spaceArray = (arr: Array<string>) => {
    return arr.map(path => `  "\${CMAKE_CURRENT_LIST_DIR}/${path}"`).join('\n')
}

const includeDirs = (header: Array<string>, includeFolders: Array<string>): string => { 
    let localHeaders = '### from project local\n'
	if (header && header.length) {
        localHeaders += `
include_directories(
${spaceArray(header)}
)`
	}
    const ideHeaders = `
### from ide
include_directories("\${CMAKE_CURRENT_LIST_DIR}/config")
include_directories("\${CMAKE_CURRENT_LIST_DIR}/config/includes")
`
    let sharedHeaders = '## from project public'
	if (includeFolders.length) {
        sharedHeaders += `
include_directories(  
${spaceArray(includeFolders)}
)`
	} else {
		sharedHeaders += '## no headers';
	}
	return localHeaders + '\n' + ideHeaders + sharedHeaders
}

const sourceFiles = (source: Array<string>) => {
    if (source.length > 0) {
        const addSource = source.map((file) => {
            return `add_source_file(${file})`;
        });
        return `## add source from config json (${source.length} files matched)
${addSource.join('\n')}`;
    } else {
        return '### project have no source code (and should not have)';
    }
}

const createTarget = (type: string, source: Array<string>, name: string): string => {
    const ret: Array<string> = [];
	if (type === 'library') {
		ret.push(`## final create ${name} library`);
		if (source.length > 0) {
			ret.push('add_library(${PROJECT_NAME} SHARED STATIC ${SOURCE_FILES})');
			ret.push('target_compile_definitions(${PROJECT_NAME} PRIVATE "PROJECT_PATH=${CMAKE_CURRENT_LIST_DIR}/")');
		} else {
			ret.push('add_library(${PROJECT_NAME} SHARED STATIC IMPORTED GLOBAL)');
			ret.push('set_property(TARGET ${PROJECT_NAME} PROPERTY IMPORTED_LOCATION');
			// if (!this.project.json.prebuilt) {
			// 	throw new PathAttachedError(resolvePath(this.project.path, CMAKE_CONFIG_FILE_NAME), missingJsonField('prebuilt'));
			// }
			// ret.push('  ' + this.spaceArray([this.project.json.prebuilt]));
			ret.push(')');
		}
	} else {
		ret.push(`## final create ${name} executable`);
		ret.push('add_executable(${PROJECT_NAME} ${SOURCE_FILES})');
		ret.push('target_compile_definitions(${PROJECT_NAME} PRIVATE "PROJECT_PATH=${CMAKE_CURRENT_LIST_DIR}/")');
	}
	return ret.join('\n');
}

const debugModeValue = (debug: boolean): string => {
    if (!debug) {
        return '# debug mode disabled';
    }
    return `# debug mode enabled
        set_property(TARGET \${PROJECT_NAME} PROPERTY JOB_POOL_COMPILE single_debug)
        set_property(TARGET \${PROJECT_NAME} PROPERTY JOB_POOL_LINK single_debug)`
}

const setProperties = (properties: ProjectConfig["properties"], definitions: ProjectConfig["definitions"] = {}, dependencies: Array<ProjectInfo> = []): string => {
    const content = [];
	if (properties && Object.keys(properties).length) {
		content.push('## set properties');
		for (const [key, value] of Object.entries(properties)) {
			content.push(`set_target_properties($\{PROJECT_NAME} PROPERTIES ${key} ${JSON.stringify(value)})`)
		}
	} else {
		content.push('## no properties')
	}
    content.push('## set definitions');
    dependencies.map(item => {
        Object.assign(definitions, item.config.definitions || {})
    })
	for (const key in definitions) {
        const value = definitions[key]
        const id = key.replace(/:raw/g, '')
		content.push(`add_compile_definitions(${id}${value ? '=' + value : ''})`);
    }
	return content.join('\n');
}

const addSubProjects = (isRoot: boolean, dependencyList: ProjectConfig["dependencies"], localDependency: ProjectConfig["localDependency"], projectName: ProjectConfig["name"]): string => {
    const lines = ['cmake_policy(SET CMP0079 NEW)']
	if (isRoot) {
        lines.push('## root project will include all dependencies')
        for (const dependency in dependencyList) {
            const dir = '${CMAKE_CURRENT_LIST_DIR}/kendryte_libraries/' + dependency
            lines.push(`add_subdirectory("${dir}" "${dependency}")`);
        }
    }

    if (localDependency) {
        lines.push('## include local dependency')
        localDependency.map(dependency => {
            const dir = join('${CMAKE_CURRENT_LIST_DIR}', dependency).replace(/\\/g, '/')
            lines.push(`add_subdirectory("${dir}" "${projectName}_${dependency}")`)
        })
    }
    
    // Simple Folder Config

	// if (this.project.directDependency.length) {
	// 	lines.push('## add simple folder dependency');
	// 	for (const { objectName, path, isSimpleFolder } of this.project.directDependency) {
	// 		if (!isSimpleFolder) {
	// 			continue;
	// 		}
	// 		const rel = relativePath(this.project.path, path);
	// 		const dir = CMAKE_CWD + '/' + rel;
	// 		lines.push(`add_subdirectory(${JSON.stringify(dir)} ${JSON.stringify(objectName)})`);
	// 	}
    // }
    
	return lines.join('\n');
}

const flags = (c_flags?: Array<string>, cpp_flags?: Array<string>, c_cpp_flags?: Array<string>): string => {
    const map = (...from: (ReadonlyArray<string> | undefined)[]) => {
        const args: string[] = [''].concat(...from.map(a => a ? a.slice() : [])).filter(e => !!e)
        const arr = args || []
        if (arr.length === 0) {
            return ''
        }

        return arr.map(item => `  ${JSON.stringify(item)}`).join('\n')
    };
    const append = (str: string, varName: string) => {
        if (str) {
            content.push(`set(FLAGS_FOR_${varName}\n${str}\n)`)
        }
        return !!str
    };

    const content: string[] = []
    content.push('')
    content.push('##### flags from config json #####')
    content.push('message("config flags for ${PROJECT_NAME}")')

    const editCFlags = append(map(c_flags, c_cpp_flags), 'C')
    const editCXXFlags = append(map(cpp_flags, c_cpp_flags), 'CXX')
    if (editCFlags || editCXXFlags) {
        content.push(`target_compile_options(\${PROJECT_NAME} PRIVATE`)
        if (editCFlags) {
            content.push(`\t$<$<COMPILE_LANGUAGE:C>:\${FLAGS_FOR_C}>`)
        }
        if (editCXXFlags) {
            content.push(`\t$<$<COMPILE_LANGUAGE:CXX>:\${FLAGS_FOR_CXX}>`)
        }
        content.push(')')
    }

    return content.join('\n')
}

const linkSubProjects = (isRoot: boolean, dependencies?: Array<ProjectInfo>): string => {
    if (!isRoot || !dependencies) {
        return '';
    }
    interface LinkArguments {
        options: Array<string>
        objects: Array<string>
    }
    const linkArguments: LinkArguments = {
        options: [
            // Default flags
            "-nostartfiles",
	        "-Wl,--gc-sections"
        ],
        objects: []
    }

    dependencies.map(dependency => {
        // Options(Link arguments and ld file)
        if (dependency.config.ld_file) {
            linkArguments.options.unshift('-T', `\${CMAKE_CURRENT_LIST_DIR}/kendryte_libraries/${dependency.config.name}/${dependency.config.ld_file}`)
        }
        if (dependency.config.link_flags) {
            linkArguments.options = dependency.config.link_flags.concat(linkArguments.options)
        }
        
        // Objects(LinkArgumentPrefix PackageName LinkArgumentSuffix and SystemLibrary)

        // Add "\"" string on arguments
        const addQuot = (list: Array<string> = []): Array<string> => {
            list.map((item, index) => {
                list[index] = `"${item}"`
            })
            return list
        }
        dependency.config.linkArgumentPrefix = addQuot(dependency.config.linkArgumentPrefix)
        dependency.config.linkArgumentSuffix = addQuot(dependency.config.linkArgumentSuffix)
        dependency.config.systemLibrary = addQuot(dependency.config.systemLibrary)

        // Add library name
        linkArguments.objects.push(`## ${dependency.config.name}`)

        // Add system library options first
        linkArguments.objects = linkArguments.objects.concat(dependency.config.systemLibrary)

        // if (!dependency.config.linkArgumentPrefix && !dependency.config.systemLibrary && !dependency.config.linkArgumentSuffix) {
        //     linkArguments.objects.push('No link component')
        //     return
        // }

        linkArguments.objects = linkArguments.objects.concat(dependency.config.linkArgumentPrefix)
        linkArguments.objects = linkArguments.objects.concat(`"${dependency.config.name}"`)
        linkArguments.objects = linkArguments.objects.concat(dependency.config.linkArgumentSuffix)
    })
    
    const p1 = linkArguments.options.map(line => {
        return `"${line}"`
    }).join('\n\t').trim()
    const p2 = linkArguments.objects.map(line => {
        return line
    }).join('\n\t').trim()

    let ret = '';
    
    // Link Arugments
    if (p1) {
        ret += `target_link_options(\${PROJECT_NAME} PUBLIC\n\t${p1}\n)\n`;
    }

    // LinkArgumentPrefix PackageName LinkArgumentSuffix systemLibrary
    if (p2) {
        ret += `target_link_libraries(\${PROJECT_NAME} PUBLIC -Wl,--start-group\n\t${p2}\n-Wl,--end-group)\n`;
    }
    return ret;
}

const finishSection = (fileReader: FileList) =>{
    return [
        fileReader.afterProject,
        "### include(fix9985)",
        fileReader.fix9985,
    ].join('\n')
}

const flashable = (isRoot: boolean, type: string, fileReader: FileList) => {
    if (isRoot && type !== 'library') {
        return fileReader.flash
    } else {
        return ''
    }
}