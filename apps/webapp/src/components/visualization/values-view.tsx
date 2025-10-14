import {HelpCircle} from 'lucide-react'
import React from 'react'
import {parse as parseYaml} from 'yaml'

import {useAttestationData} from '@/components/attestation-data-context'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {getFieldDescription} from '@/data/field-documentation'
import {cn} from '@/lib/utils'
import 'highlight.js/styles/github.css'
import hljs from 'highlight.js'

const ValuesView: React.FC = () => {
  const {selectedObject, setSelectedObjectId, attestationData} =
    useAttestationData()
  const [expandedField, setExpandedField] = React.useState<{
    key: string
    value: unknown
  } | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)

  // Format value for display in dialog
  const formatValueForDialog = (value: unknown, type: string) => {
    if (type === 'json') {
      let jsonString: string
      if (Array.isArray(value)) {
        jsonString = JSON.stringify(value, null, 2)
      } else if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          jsonString = JSON.stringify(parsed, null, 2)
        } catch {
          return value
        }
      } else {
        jsonString = JSON.stringify(value, null, 2)
      }
      return hljs.highlight(jsonString, {language: 'json'}).value
    }
    if (type === 'yaml') {
      const yamlString = String(value)
      return hljs.highlight(yamlString, {language: 'yaml'}).value
    }
    return String(value)
  }

  // Measured By table
  const measuredByRows = React.useMemo(() => {
    if (!selectedObject || !selectedObject.measuredBy) return []
    // Assemble data
    const rows = selectedObject.measuredBy
      .map((ref) => {
        const sourceObj = attestationData.find((o) => o.id === ref.objectId)
        return {
          sourceObject: sourceObj,
          sourceObjectId: ref.objectId,
          sourceObjectName: sourceObj?.name || '-',
          sourceField: ref.fieldName || ref.calcOutputName || '-',
          targetField: ref.selfFieldName || ref.selfCalcOutputName || '-',
          isCalculation: !!(ref.calcOutputName || ref.selfCalcOutputName),
        }
      })
      .filter((row) => row.sourceObject)
    // Sort by source selectedObject name, then by source field
    rows.sort((a, b) => {
      if (a.sourceObjectName !== b.sourceObjectName) {
        return a.sourceObjectName.localeCompare(b.sourceObjectName)
      }
      return a.sourceField.localeCompare(b.sourceField)
    })
    return rows
  }, [selectedObject, attestationData])

  // Calculate row spans for merging cells
  function calcMeasuredByRowSpans(
    rows: Array<{
      sourceObjectId: string
      sourceField: string
      targetField: string
    }>,
  ) {
    const selectedObjectRowSpans = Array(rows.length).fill(0)
    const fieldRowSpans = Array(rows.length).fill(0)
    const targetRowSpans = Array(rows.length).fill(0)
    let i = 0
    while (i < rows.length) {
      // Merge source selectedObjects
      let j = i + 1
      while (
        j < rows.length &&
        rows[j].sourceObjectId === rows[i].sourceObjectId
      )
        j++
      selectedObjectRowSpans[i] = j - i
      // Merge source fields (when source selectedObject is the same)
      let k = i
      while (k < j) {
        let l = k + 1
        while (l < j && rows[l].sourceField === rows[k].sourceField) l++
        fieldRowSpans[k] = l - k
        k = l
      }
      // Merge target fields (when source selectedObject is the same)
      let m = i
      while (m < j) {
        let n = m + 1
        while (n < j && rows[n].targetField === rows[m].targetField) n++
        targetRowSpans[m] = n - m
        m = n
      }
      i = j
    }
    return {selectedObjectRowSpans, fieldRowSpans, targetRowSpans}
  }
  const {
    selectedObjectRowSpans: measuredByObjectRowSpans,
    fieldRowSpans: measuredByFieldRowSpans,
    targetRowSpans: measuredByTargetRowSpans,
  } = calcMeasuredByRowSpans(measuredByRows)

  // Measurements table
  const measurementsRows = React.useMemo(() => {
    if (!selectedObject) return []
    // Iterate through all selectedObjects to find which selectedObjects' measuredBy points to current selectedObject
    const rows: Array<{
      sourceField: string
      targetObject: (typeof attestationData)[0]
      targetObjectId: string
      targetObjectName: string
      targetField: string
      isCalculation: boolean
    }> = []
    attestationData.forEach((obj) => {
      if (!obj.measuredBy) return
      obj.measuredBy.forEach((ref) => {
        if (ref.objectId === selectedObject.id) {
          rows.push({
            sourceField: ref.selfFieldName || ref.selfCalcOutputName || '-',
            targetObject: obj,
            targetObjectId: obj.id,
            targetObjectName: obj.name || '-',
            targetField: ref.fieldName || ref.calcOutputName || '-',
            isCalculation: !!(ref.calcOutputName || ref.selfCalcOutputName),
          })
        }
      })
    })
    // Sort by source field, then by target selectedObject name
    rows.sort((a, b) => {
      if (a.sourceField !== b.sourceField) {
        return a.sourceField.localeCompare(b.sourceField)
      }
      if (a.targetObjectName !== b.targetObjectName) {
        return a.targetObjectName.localeCompare(b.targetObjectName)
      }
      return a.targetField.localeCompare(b.targetField)
    })
    return rows
  }, [selectedObject, attestationData])

  function calcMeasurementsRowSpans(
    rows: Array<{
      sourceField: string
      targetObjectId: string
      targetField: string
    }>,
  ) {
    const sourceFieldRowSpans = Array(rows.length).fill(0)
    const selectedObjectRowSpans = Array(rows.length).fill(0)
    let i = 0
    while (i < rows.length) {
      // Merge source fields
      let j = i + 1
      while (j < rows.length && rows[j].sourceField === rows[i].sourceField) j++
      sourceFieldRowSpans[i] = j - i
      // Merge target selectedObjects (when source field is the same)
      let k = i
      while (k < j) {
        let l = k + 1
        while (l < j && rows[l].targetObjectId === rows[k].targetObjectId) l++
        selectedObjectRowSpans[k] = l - k
        k = l
      }
      i = j
    }
    return {sourceFieldRowSpans, selectedObjectRowSpans}
  }
  const {
    sourceFieldRowSpans: measurementsSourceFieldRowSpans,
    selectedObjectRowSpans: measurementsObjectRowSpans,
  } = calcMeasurementsRowSpans(measurementsRows)

  // Get value type and color
  const getValueType = (value: unknown) => {
    if (typeof value === 'string') {
      // Check for hash (hex string)
      if (/^[a-fA-F0-9]+$/i.test(value.replace(/^0x/, ''))) {
        return {type: 'hash', color: 'text-muted-foreground'}
      }
      // Check for URL
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return {type: 'url', color: 'text-blue-600'}
      }
      // Check for JSON (try to parse)
      const trimmedValue = value.trim()
      if (
        (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
        (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
      ) {
        try {
          JSON.parse(value)
          return {type: 'json', color: 'text-blue-600'}
        } catch {
          // Not valid JSON
        }
      }
      // Check for YAML (try to parse)
      if (
        value.includes(':') &&
        (value.includes('-') ||
          value.includes('version:') ||
          value.includes('name:'))
      ) {
        try {
          parseYaml(value)
          return {type: 'yaml', color: 'text-blue-600'}
        } catch {
          // Not valid YAML
        }
      }
      return {type: 'string', color: 'text-foreground'}
    }
    if (typeof value === 'number') {
      return {type: 'string', color: 'text-foreground'}
    }
    if (typeof value === 'boolean') {
      return {type: 'string', color: 'text-foreground'}
    }
    if (Array.isArray(value)) {
      return {type: 'json', color: 'text-blue-600'}
    }
    if (value === null) {
      return {type: 'string', color: 'text-foreground'}
    }
    return {type: 'string', color: 'text-foreground'}
  }

  if (!selectedObject) {
    return (
      <div className="p-3 text-center text-muted-foreground text-xs">
        Select an selectedObject to view its fields and measurements.
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="text-xs">
        {/* Field Value Dialog */}
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
          }}
        >
          <DialogContent className="!max-w-3xl max-h-[90vh] w-full">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {expandedField?.key}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[75vh] overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-3 font-mono text-xs">
              {expandedField && (
                <pre
                  className="hljs !bg-transparent"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: we need to set the inner HTML to the formatted value
                  dangerouslySetInnerHTML={{
                    __html: formatValueForDialog(
                      expandedField.value,
                      getValueType(expandedField.value).type,
                    ),
                  }}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
        {/* Object Header */}
        <div className="p-2">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="font-semibold text-sm">{selectedObject.name}</h2>
          </div>
          {selectedObject.description && (
            <div className="text-muted-foreground text-xs">
              {selectedObject.description}
            </div>
          )}
        </div>

        {/* Object Fields */}
        <div className="mt-4">
          <h3 className="p-1 font-medium text-xs">Fields</h3>
          <div>
            {Object.entries(selectedObject.fields).map(([key, value]) => {
              const strValue = String(value)
              const valueType = getValueType(value)
              const fieldDescription = getFieldDescription(
                selectedObject.id,
                key,
              )

              return (
                <div key={key}>
                  <div className="flex items-center justify-between bg-muted/60 px-2 py-1">
                    <div className="flex items-center gap-1">
                      <div className="font-bold text-xs">{key}</div>
                      {fieldDescription && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-xs">{fieldDescription}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={cn(
                      'w-full cursor-pointer px-2 py-1 text-left font-mono text-xs hover:bg-gray-50',
                      valueType.color,
                    )}
                    onClick={() => {
                      if (valueType.type !== 'url') {
                        setExpandedField({key, value: value})
                        setIsDialogOpen(true)
                      }
                    }}
                  >
                    {value === null || value === undefined || value === '' ? (
                      <span className="text-muted-foreground italic">
                        &lt;empty&gt;
                      </span>
                    ) : valueType.type === 'url' ? (
                      <div className="break-all">
                        <a
                          href={strValue}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline hover:text-blue-800"
                        >
                          {strValue}
                        </a>
                      </div>
                    ) : (
                      <div className="line-clamp-3 break-all">{strValue}</div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Calculations */}
        {selectedObject.calculations && (
          <div className="mt-4">
            <h3 className="p-1 font-medium text-xs">Calculations</h3>
            <div>
              {selectedObject.calculations.map((calc, index) => (
                <div
                  key={`calc-${index}-${calc.inputs.join('-')}-${calc.outputs.join('-')}`}
                  className="px-2 py-1"
                >
                  <div className="text-xs">
                    <span className="text-muted-foreground">Inputs: </span>
                    {calc.inputs.join(', ')}
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Function: </span>
                    {calc.calcFunc}
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Outputs: </span>
                    {calc.outputs.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What this selectedObject is measured by */}
        {measuredByRows.length > 0 && (
          <div className="mt-4">
            <h3 className="p-1 font-medium text-xs">Measured By</h3>
            <div className="border-t border-b">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="p-1 text-left font-medium">Source</th>
                    <th className="p-1 text-left font-medium"></th>
                    <th className="p-1 text-left font-medium">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {measuredByRows.map((row, index) => (
                    <tr
                      key={`measured-by-${row.sourceObjectId}-${row.sourceField}-${index}`}
                      className="border-t"
                    >
                      {measuredByObjectRowSpans[index] > 0 && (
                        <td
                          className="p-1 align-middle"
                          rowSpan={measuredByObjectRowSpans[index]}
                        >
                          <button
                            type="button"
                            className="text-left text-blue-600 underline hover:text-blue-800"
                            onClick={() =>
                              setSelectedObjectId(row.sourceObjectId)
                            }
                          >
                            {row.sourceObjectName}
                          </button>
                        </td>
                      )}
                      {measuredByFieldRowSpans[index] > 0 && (
                        <td
                          className="p-1 align-middle"
                          rowSpan={measuredByFieldRowSpans[index]}
                        >
                          <span>{row.sourceField}</span>
                        </td>
                      )}
                      {measuredByTargetRowSpans[index] > 0 && (
                        <td
                          className="p-1 align-middle"
                          rowSpan={measuredByTargetRowSpans[index]}
                        >
                          <span>{row.targetField}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* What this selectedObject measures */}
        {measurementsRows.length > 0 && (
          <div className="mt-4">
            <h3 className="p-1 font-medium text-xs">Measurements</h3>
            <div className="border-t border-b">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/60">
                    <th className="p-1 text-left font-medium">Self Field</th>
                    <th className="p-1 text-left font-medium">Target</th>
                    <th className="p-1 text-left font-medium">Field</th>
                  </tr>
                </thead>
                <tbody>
                  {measurementsRows.map((row, index) => (
                    <tr
                      key={`measurement-${row.targetObjectId}-${row.sourceField}-${index}`}
                      className="border-t"
                    >
                      <td className="p-1 align-middle">
                        <span>{row.targetField}</span>
                      </td>

                      {measurementsObjectRowSpans[index] > 0 && (
                        <td
                          className="p-1 align-middle"
                          rowSpan={measurementsObjectRowSpans[index]}
                        >
                          <button
                            type="button"
                            className="text-left text-blue-600 underline hover:text-blue-800"
                            onClick={() =>
                              setSelectedObjectId(row.targetObjectId)
                            }
                          >
                            {row.targetObjectName}
                          </button>
                        </td>
                      )}
                      {measurementsSourceFieldRowSpans[index] > 0 && (
                        <td
                          className="p-1 align-middle"
                          rowSpan={measurementsSourceFieldRowSpans[index]}
                        >
                          <span>{row.sourceField}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default ValuesView
